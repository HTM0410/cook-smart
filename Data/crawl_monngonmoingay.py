#!/usr/bin/env python
"""
Crawler cho monngonmoingay.com, chỉ ghi ra CSV (chưa động vào DB).

Thiết kế để:
- Crawl 1 URL công thức (ví dụ: https://monngonmoingay.com/pho-cuon/)
- Parse: tiêu đề, ảnh, mô tả, khẩu phần, độ khó, thời gian, nguyên liệu, các bước, tags
- Ghi ra các file CSV: recipes.csv, ingredients.csv, steps.csv, categories.csv
  trong thư mục output (mặc định: Data/monngonmoingay_export).

Phụ thuộc:
    pip install requests beautifulsoup4

Chạy thử (ví dụ 1 URL):
    python crawl_monngonmoingay.py --url https://monngonmoingay.com/pho-cuon/
"""

import os
import re
import csv
import argparse
from dataclasses import dataclass
from typing import List, Optional, Tuple, Dict

import requests
from bs4 import BeautifulSoup



# ---------------------------------------------------------------------------
# Config (CSV only, no DB)
# ---------------------------------------------------------------------------

OUTPUT_DIR = os.getenv(
    "CRAWL_OUTPUT_DIR",
    os.path.join(os.path.dirname(__file__), "monngonmoingay_export"),
)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; FoodSuggestCrawler/1.0; +https://food-suggest.local)"
}


# ---------------------------------------------------------------------------
# Data models (in-memory)
# ---------------------------------------------------------------------------

@dataclass
class RecipeCore:
    name: str
    description: Optional[str]
    image_url: Optional[str]
    servings: Optional[int]
    difficulty: Optional[str]  # 'easy' | 'medium' | 'hard' | None
    prep_time: Optional[int]   # minutes
    cook_time: Optional[int]   # minutes


@dataclass
class ParsedIngredient:
    name: str
    quantity: Optional[float]
    unit: Optional[str]
    notes: Optional[str]
    category_name: Optional[str]  # giữ field nhưng không còn tự đoán


@dataclass
class ParsedStep:
    step_number: int
    instruction: str


@dataclass
class ParsedCategoryTag:
    name: str
    category_type: str  # 'cuisine' | 'course' | 'tag'


@dataclass
class ParsedRecipeDoc:
    core: RecipeCore
    ingredients: List[ParsedIngredient]
    steps: List[ParsedStep]
    categories: List[ParsedCategoryTag]
    source_url: str


# ---------------------------------------------------------------------------
# Utils
# ---------------------------------------------------------------------------

def clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def extract_int_from_text(text: str) -> Optional[int]:
    m = re.search(r"(\d+)", text)
    if not m:
        return None
    try:
        return int(m.group(1))
    except ValueError:
        return None


def vn_difficulty_to_enum(label: str) -> Optional[str]:
    s = label.lower()
    if "dễ" in s:
        return "easy"
    if "trung" in s:
        return "medium"
    if "khó" in s:
        return "hard"
    return None


def guess_ingredient_category(name: str) -> str:
    """Đoán category đơn giản dựa trên keyword tiếng Việt."""
    s = name.lower()
    if any(k in s for k in ["bò", "heo", "thịt", "gà", "vịt", "tôm", "cua", "cá", "mực"]):
        return "Thịt / Hải sản"
    if any(k in s for k in ["rau", "xà lách", "xà lách", "dưa leo", "cà rốt", "hành", "tỏi", "ớt"]):
        return "Rau củ quả"
    if any(k in s for k in ["dầu", "bơ"]):
        return "Dầu ăn"
    if any(k in s for k in ["nước mắm", "nước tương", "muối", "đường", "tiêu", "bột ngọt", "giấm"]):
        return "Gia vị"
    if any(k in s for k in ["phở", "bún", "hủ tiếu", "nui", "mì", "gạo", "nếp"]):
        return "Ngũ cốc"
    if any(k in s for k in ["trứng"]):
        return "Trứng"
    if any(k in s for k in ["đậu", "đậu hũ", "đậu phụ"]):
        return "Đậu & sản phẩm từ đậu"
    if any(k in s for k in ["nấm"]):
        return "Nấm"
    return "Khác"


def parse_ingredient_line(line: str) -> ParsedIngredient:
    """
    Parse 1 dòng nguyên liệu THÀNH NHIỀU item (list) theo rule:
    - Bỏ hết sản phẩm có chữ 'aji' / 'ajinomoto'...
    - Chỉ quan tâm phần có dấu chấm đen (li) ở ngoài, caller sẽ truyền từng <li>.
    - Nếu không có dấu ':' và có dấu ',' bên trong -> tách thành nhiều nguyên liệu.
    - Nếu có ':':
        + Sau ':' KHÔNG chứa số -> bỏ phần trước, phần sau ':' là chuỗi các nguyên liệu,
          có dấu ',' thì tách tiếp.
        + Sau ':' CÓ số -> phần trước ':' là tên, phần sau là định lượng (giữ nguyên cơ chế cũ).
    """

    def is_aji(text: str) -> bool:
        s = text.lower()
        return any(
            key in s
            for key in [
                "aji",
                "ajinomoto",
                "aji-quick",
                "aji quick",
                "aji-ngon",
                "aji ngon",
            ]
        )

    def split_names(raw: str):
        parts = [clean_text(p) for p in raw.split(",")]
        return [p for p in parts if p and not is_aji(p)]

    original = clean_text(line)

    # Bỏ riêng các dòng "Gram" / "Muỗng" dùng để giải thích đơn vị
    if original.lower() in {"gram", "muỗng"}:
        return []

    # Nếu là dòng chú thích "M: muỗng canh - m: muỗng cafe" thì bỏ qua hẳn
    if re.match(r"^[Mm]\s*:", original):
        return []

    # Không có ':' -> có thể là "Tiêu, đường, nước mắm"
    if ":" not in original:
        names = split_names(original)
        return [
            ParsedIngredient(
                name=n,
                quantity=None,
                unit=None,
                notes=None,
                category_name=None,
            )
            for n in names
        ]

    # Có dấu ':' -> xử lý theo 2 nhánh
    name_part, qty_part = [clean_text(x) for x in original.split(":", 1)]

    # Nếu sau ':' không có số -> bỏ phần trước, phần sau là danh sách nguyên liệu
    if not re.search(r"\d", qty_part):
        names = split_names(qty_part)
        return [
            ParsedIngredient(
                name=n,
                quantity=None,
                unit=None,
                notes=None,
                category_name=None,
            )
            for n in names
        ]

    # Sau ':' có số -> coi phần sau là định lượng cho phần trước
    qty_match = re.match(r"^\s*([\d.,/]+)\s*([a-zA-ZáàảãạăâêôơưđĐµ%]*)", qty_part)
    quantity = None
    unit = None
    notes = None

    if qty_match:
        raw_qty = qty_match.group(1)
        unit = qty_match.group(2) or None
        # thử parse số dạng 500, 1.5, 1/2
        raw_qty = raw_qty.replace(",", ".")
        if "/" in raw_qty:
            # dạng phân số
            try:
                num, den = raw_qty.split("/", 1)
                quantity = float(num) / float(den)
            except Exception:
                quantity = None
        else:
            try:
                quantity = float(raw_qty)
            except Exception:
                quantity = None

        rest = qty_part[qty_match.end() :].strip()
        notes = rest or None
    else:
        # Không parse được số, coi toàn bộ là notes
        notes = qty_part

    if is_aji(name_part):
        return []

    return [
        ParsedIngredient(
            name=name_part,
            quantity=quantity,
            unit=unit,
            notes=notes,
            category_name=None,
        )
    ]


# ---------------------------------------------------------------------------
# HTML parsing cho 1 trang công thức
# ---------------------------------------------------------------------------

def fetch_html(url: str) -> str:
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return resp.text


def parse_recipe_page(url: str, html: str) -> ParsedRecipeDoc:
    soup = BeautifulSoup(html, "html.parser")

    # Tiêu đề món
    title_el = soup.find("h1")
    title_text = clean_text(title_el.get_text()) if title_el else url

    # Ảnh chính: đoán từ thẻ <img> trong khu vực nội dung chính
    hero_img = None
    main_img = soup.find("img")
    if main_img and main_img.get("src"):
        hero_img = main_img["src"]

    # Khẩu phần / độ khó / thời gian: website có thể có block riêng, nên ta tìm theo text
    servings = None
    difficulty = None
    prep_time = None
    cook_time = None

    # tìm mọi text chứa "Khẩu phần" / "khẩu phần"
    for el in soup.find_all(text=re.compile(r"[Kk]hẩu phần")):
        servings = extract_int_from_text(el)
        if servings:
            break

    # độ khó
    for el in soup.find_all(text=re.compile(r"[Đđ]ộ khó")):
        difficulty = vn_difficulty_to_enum(el)
        if difficulty:
            break

    # thời gian thực hiện / nấu (nhiều site không tách rõ; tạm parse 1 số duy nhất)
    for el in soup.find_all(text=re.compile(r"[Tt]hời gian")):
        minutes = extract_int_from_text(el)
        if minutes:
            cook_time = minutes
            break

    # Mô tả: đoạn text đầu tiên ngay sau tiêu đề
    description = None
    if title_el:
        p = title_el.find_next("p")
        if p:
            description = clean_text(p.get_text())

    # Nguyên liệu: tìm section có heading "Nguyên liệu"
    ingredients: List[ParsedIngredient] = []
    seen_ing_texts = set()
    ing_heading = None
    for h in soup.find_all(re.compile("^h[2-4]$")):
        if "nguyên liệu" in h.get_text(strip=True).lower():
            ing_heading = h
            break

    if ing_heading:
        # Chỉ lấy các <li> (chấm đen), bỏ <p> mô tả
        for sib in ing_heading.find_all_next():
            if sib.name and sib.name.startswith("h") and sib.name != ing_heading.name:
                break
            if sib.name == "li":
                text = clean_text(sib.get_text())
                if text:
                    # bỏ các dòng label lặp ("Nguyên liệu", rất ngắn, v.v.)
                    if len(text) < 3:
                        continue
                    # tránh bị lặp do site render 2 lần cùng 1 block nguyên liệu
                    if text in seen_ing_texts:
                        continue
                    seen_ing_texts.add(text)
                    parsed_list = parse_ingredient_line(text)
                    for ing in parsed_list:
                        ingredients.append(ing)

    # Bước nấu: gom cả phần \"Sơ Chế\" + \"Thực Hiện\"
    steps: List[ParsedStep] = []
    step_sections: List[Tuple[str, List[str]]] = []  # (title, lines)

    def collect_section(title_regex: str):
        for h in soup.find_all(re.compile("^h[2-4]$")):
            if re.search(title_regex, h.get_text(strip=True), flags=re.I):
                lines: List[str] = []
                for sib in h.find_all_next():
                    if sib.name and sib.name.startswith("h") and sib.name != h.name:
                        break
                    if sib.name in ("li", "p"):
                        txt = clean_text(sib.get_text())
                        if txt:
                            lines.append(txt)
                if lines:
                    step_sections.append((h.get_text(strip=True), lines))
                break

    collect_section(r"sơ chế")
    collect_section(r"thực hiện")

    step_num = 1
    for _, lines in step_sections:
        for line in lines:
            steps.append(ParsedStep(step_number=step_num, instruction=line))
            step_num += 1

    # Tags / Danh mục: cố gắng tìm khu vực \"Tags\" hoặc \"Tags\" trong HTML
    categories: List[ParsedCategoryTag] = []
    # Chiến lược đơn giản: mọi link trong section có chữ \"Tags\" hoặc \"Từ khóa\"
    for tag_heading in soup.find_all(text=re.compile(r"Tags|Từ khóa|Từ khoá", re.I)):
        parent = tag_heading.parent
        if not parent:
            continue
        for a in parent.find_all_next("a", href=True):
            txt = clean_text(a.get_text())
            if not txt:
                continue
            # thô: xem như tag
            categories.append(ParsedCategoryTag(name=txt, category_type="tag"))
        break

    # Nếu trang không cung cấp tags, có thể tự sinh một số category cơ bản
    if not categories:
        if "phở" in title_text.lower():
            categories.append(ParsedCategoryTag(name="Phở", category_type="course"))

    core = RecipeCore(
        name=title_text,
        description=description,
        image_url=hero_img,
        servings=servings,
        difficulty=difficulty,
        prep_time=prep_time,
        cook_time=cook_time,
    )

    return ParsedRecipeDoc(
        core=core,
        ingredients=ingredients,
        steps=steps,
        categories=categories,
        source_url=url,
    )


# ---------------------------------------------------------------------------
# CSV helpers (không chạm DB)
# ---------------------------------------------------------------------------

def ensure_output_dir():
    os.makedirs(OUTPUT_DIR, exist_ok=True)


def append_csv(path: str, header: List[str], rows: List[List[object]]):
    """Append các hàng vào file CSV, tự động ghi header nếu file chưa tồn tại hoặc rỗng."""
    need_header = True
    if os.path.exists(path) and os.path.getsize(path) > 0:
        need_header = False

    with open(path, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if need_header:
            writer.writerow(header)
        for row in rows:
            writer.writerow(row)


def detect_delimiter_and_reader(f) -> csv.DictReader:
    """Đoán delimiter (tab hoặc phẩy) và trả về DictReader bắt đầu từ đầu file."""
    first_line = f.readline()
    if "\t" in first_line and "," not in first_line:
        delimiter = "\t"
    else:
        delimiter = ","
    f.seek(0)
    return csv.DictReader(f, delimiter=delimiter)


def load_url_to_id(recipes_csv_path: str) -> Dict[str, int]:
    """
    Đọc file master (ví dụ: monngonmoingay_recipes_clean - Copy.csv) với cột:
        id,title,url
    Trả về dict map: url -> id (int).
    """
    mapping: Dict[str, int] = {}
    with open(recipes_csv_path, newline="", encoding="utf-8-sig") as f:
        reader = detect_delimiter_and_reader(f)
        for row in reader:
            url = (row.get("url") or "").strip()
            rid = row.get("id")
            if not url or not rid:
                continue
            try:
                mapping[url] = int(rid)
            except ValueError:
                continue
    return mapping


def iter_master_rows(recipes_csv_path: str):
    """
    Generator trả về (id:int, url:str) cho từng dòng hợp lệ trong file master.
    """
    with open(recipes_csv_path, newline="", encoding="utf-8-sig") as f:
        reader = detect_delimiter_and_reader(f)
        for row in reader:
            url = (row.get("url") or "").strip()
            rid = row.get("id")
            if not url or not rid:
                continue
            try:
                rid_int = int(rid)
            except ValueError:
                continue
            yield rid_int, url


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def crawl_single(recipe_id: int, url: str) -> None:
    print(f"🔎 Crawling: id={recipe_id} url={url}")
    html = fetch_html(url)
    doc = parse_recipe_page(url, html)

    print(f"📄 Parsed recipe: {doc.core.name}")
    print(f"   - Servings: {doc.core.servings}")
    print(f"   - Difficulty: {doc.core.difficulty}")
    print(f"   - Ingredients: {len(doc.ingredients)}")
    print(f"   - Steps: {len(doc.steps)}")
    print(f"   - Categories: {[c.name for c in doc.categories]}")

    # Ghi ra CSV
    ensure_output_dir()

    # 1) recipes.csv
    recipes_path = os.path.join(OUTPUT_DIR, "recipes.csv")
    append_csv(
        recipes_path,
        header=[
            "recipe_id",
            "source_url",
            "recipe_name",
            "description",
            "image_url",
            "servings",
            "difficulty",
            "prep_time",
            "cook_time",
        ],
        rows=[
            [
                recipe_id,
                doc.source_url,
                doc.core.name,
                doc.core.description or "",
                doc.core.image_url or "",
                doc.core.servings or "",
                doc.core.difficulty or "",
                doc.core.prep_time or "",
                doc.core.cook_time or "",
            ]
        ],
    )

    # 2) ingredients.csv
    ingredients_path = os.path.join(OUTPUT_DIR, "ingredients.csv")
    ing_rows: List[List[object]] = []
    for ing in doc.ingredients:
        ing_rows.append(
            [
                recipe_id,
                doc.source_url,
                ing.name,
                ing.quantity if ing.quantity is not None else "",
                ing.unit or "",
                ing.notes or "",
            ]
        )
    append_csv(
        ingredients_path,
        header=[
            "recipe_id",
            "source_url",
            "ingredient_name",
            "quantity",
            "unit",
            "notes",
        ],
        rows=ing_rows,
    )

    # 3) steps.csv
    steps_path = os.path.join(OUTPUT_DIR, "steps.csv")
    step_rows: List[List[object]] = []
    for step in doc.steps:
        step_rows.append(
            [
                recipe_id,
                doc.source_url,
                step.step_number,
                step.instruction,
            ]
        )
    append_csv(
        steps_path,
        header=["recipe_id", "source_url", "step_number", "instruction"],
        rows=step_rows,
    )

    # Bỏ thu thập categories theo yêu cầu, chỉ log ra để tham khảo
    if doc.categories:
        print(f"   - (bỏ qua ghi categories.csv, categories hiện có: {[c.name for c in doc.categories]})")

    print(f"✅ Appended to CSVs (recipes/ingredients/steps) in: {OUTPUT_DIR}")


def main():
    parser = argparse.ArgumentParser(description="Crawl monngonmoingay.com recipes into CSV.")
    parser.add_argument(
        "--url",
        required=False,
        help="(Tuỳ chọn) URL trang công thức đơn lẻ, ví dụ: https://monngonmoingay.com/pho-cuon/",
    )
    parser.add_argument(
        "--recipes-csv",
        required=True,
        help="File master chứa id,title,url (ví dụ: 'monngonmoingay_recipes_clean - Copy.csv')",
    )
    args = parser.parse_args()

    if args.url:
        # Chế độ crawl một URL: dùng mapping url->id từ file master
        url_to_id = load_url_to_id(args.recipes_csv)
        if not url_to_id:
            print(f"❌ Không đọc được mapping url->id từ file: {args.recipes_csv}")
            return
        recipe_id = url_to_id.get(args.url.strip())
        if recipe_id is None:
            print(f"❌ URL không tồn tại trong file master (không tìm thấy id): {args.url}")
            return
        crawl_single(recipe_id, args.url)
    else:
        # Chế độ crawl toàn bộ file master: lặp qua từng (id,url)
        any_row = False
        for rid, url in iter_master_rows(args.recipes_csv):
            any_row = True
            crawl_single(rid, url)
        if not any_row:
            print(f"❌ Không tìm được dòng hợp lệ (id,url) trong file: {args.recipes_csv}")


if __name__ == "__main__":
    main()

