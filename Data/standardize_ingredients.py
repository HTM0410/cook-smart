#!/usr/bin/env python
"""
Chuẩn hoá tên nguyên liệu từ file ingredients_final_clean2.csv.

Ý tưởng:
- Đọc toàn bộ file input (mặc định: ingredients_final_clean2.csv).
- Lấy tất cả tên nguyên liệu duy nhất (ingredient_name).
- Tạo một "khóa chuẩn hoá" cho mỗi tên:
    + lowercase
    + bỏ dấu tiếng Việt
    + bỏ ký tự ®, ©, dấu chấm, phẩy, ngoặc, v.v.
    + gom nhiều khoảng trắng thành 1
- Gom nhóm theo khóa chuẩn hoá => các tên giống hoặc gần giống sẽ rơi vào cùng nhóm.
- Với mỗi nhóm:
    + Chọn ra 1 tên làm "tên chuẩn" (canonical_name): ưu tiên tên ngắn nhất.
    + Gán một ingredient_id tăng dần.
- Xuất ra 3 file:
    1) ingredients_canonical.csv
       - ingredient_id,canonical_name,normalized_key,variants_count
    2) ingredients_original_mapping.csv
       - original_name,canonical_id,canonical_name,normalized_key
         (mỗi tên gốc một dòng, giúp map mọi biến thể về mã chuẩn)
    3) ingredients_with_canonical_id.csv
       - giống file input nhưng thêm cột canonical_id ở cuối.
"""

import csv
import os
import re
import unicodedata
from collections import defaultdict
from typing import Dict, List, Tuple


INPUT_PATH = os.getenv(
    "INGREDIENT_INPUT_PATH",
    r"H:\2025.2\DA\Chuẩn hóa dữ liệu\Công thức\ingredients_final_clean5.csv",
)

OUTPUT_DIR = os.getenv(
    "INGREDIENT_OUTPUT_DIR",
    os.path.join(os.path.dirname(__file__), "ingredient_standardize_output"),
)


def ensure_output_dir():
    os.makedirs(OUTPUT_DIR, exist_ok=True)


def strip_accents(s: str) -> str:
    """
    Bỏ dấu tiếng Việt: 'Đường' -> 'Duong'
    """
    nfkd_form = unicodedata.normalize("NFKD", s)
    return "".join([c for c in nfkd_form if not unicodedata.combining(c)])


def normalize_name(name: str) -> str:
    """
    Chuẩn hoá tên nguyên liệu để gom nhóm:
    - lowercase
    - bỏ ký tự đặc biệt / thương hiệu (®, ©, ™, "R", ...)
    - bỏ ngoặc, dấu chấm phẩy, gạch chéo, v.v. (giữ lại chữ và số)
    - gom nhiều khoảng trắng thành 1
    """
    s = name.strip()
    # Bỏ ký tự thương hiệu phổ biến
    s = re.sub(r"[®©™]", " ", s)
    # Giữ nguyên dấu tiếng Việt, chỉ đưa về lowercase
    s = s.lower()
    # Bỏ mọi ký tự không phải chữ cái (kể cả tiếng Việt), số, khoảng trắng
    # Dùng dải unicode letter \w vẫn giữ được chữ có dấu
    s = re.sub(r"[^\w\s]", " ", s, flags=re.UNICODE)
    # Gom nhiều khoảng trắng
    s = re.sub(r"\s+", " ", s).strip()
    return s


def is_invalid_ingredient(name: str) -> bool:
    """
    Heuristic để loại các 'nguyên liệu' lỗi / dụng cụ:
    - Chứa từ khoá như 'máy', 'khuôn', 'khuay', 'ly', 'tô', 'chén', 'muỗng', 'dao', ...
    - Hoặc quá dài (description hơn là tên).
    Có thể chỉnh sửa/ mở rộng rule sau.
    """
    s = name.lower()
    tool_keywords = [
        "máy ",
        "khuôn ",
        "phới ",
        "dao ",
        "nồi ",
        "chảo ",
        "tô ",
        "chén ",
        "ly ",
        "muỗng ",
        "muong ",
        "khuay ",
        "khay ",
    ]
    if any(k in s for k in tool_keywords):
        return True
    # Loại bỏ các nguyên liệu cua chung chung (không rõ loại),
    # chỉ giữ các loại cua đồng / cua xay được map riêng.
    if "cua" in s and "cua đồng" not in s and "cua xay" not in s:
        return True
    # Bóc vỏ: xóa nguyên liệu này và mapping tương ứng
    if "bóc vỏ" in s:
        return True
    # Bánh Mí (typo): xóa hết nguyên liệu dạng này
    if "bánh mí" in s:
        return True
    # Nếu quá dài thì nhiều khả năng là mô tả sai
    if len(s) > 80:
        return True
    return False


# ---------------------------------------------------------------------------
# Rule phát hiện \"nguyên liệu gốc\" (base) để gom nhóm
# ---------------------------------------------------------------------------

BASE_RULES = [
    # --- Nhóm thịt ---
    # Thịt gà: gộp các biến thể có gà nhưng không phải xương
    ("Thịt gà", ["gà"], ["xương"]),
    # Thịt bò: gộp các biến thể bò (phi lê, bắp, nạm...) nhưng không xương
    ("Thịt bò", ["bò"], ["xương"]),
    # Thịt heo / lợn
    ("Thịt heo", ["heo"], ["xương"]),
    ("Thịt heo", ["thịt lợn"], ["xương"]),

    # --- Nhóm tỏi / hành ---
    ("Tỏi", ["tỏi"], []),
    # Hành các loại – gom nhẹ
    ("Hành lá", ["hành lá"], []),
    ("Hành tây", ["hành tây"], []),
    ("Hành", ["hành"], ["tây", "lá"]),

    # --- Gia vị cơ bản ---
    ("Muối", ["muối"], []),
    ("Đường", ["đường"], []),
    ("Tiêu", ["tiêu"], []),
    ("Dầu ăn", ["dầu ăn"], []),
    ("Dầu mè", ["dầu mè"], []),
    ("Nước mắm", ["nước mắm"], []),

    # --- Bacon: mọi biến thể -> Bacon ---
    ("Bacon", ["bacon"], []),

    # --- Bạc hà: gộp mọi biến thể (kể cả không dấu) ---
    ("Bạc hà", ["bạc hà"], []),

    # --- Ba Rọi: giữ tên ngắn, gộp mọi biến thể dài ---
    ("Ba Rọi", ["ba rọi"], []),

    # --- Boa rô: mọi biến thể (kể cả Boaro/Boarô không cách) -> Boa rô ---
    ("Boa rô", ["boa rô"], []),
    ("Boa rô", ["boaro"], []),
    ("Boa rô", ["boarô"], []),

    # --- Bún: gộp các loại bún nói chung ---
    ("Bún", ["bún"], []),

    # --- Bánh mì: chia 3 loại chính ---
    # Bánh mì sandwich
    ("Bánh mì sandwich", ["bánh mì", "sandwich"], []),
    # Bánh mì burge (burger, hot dog...)
    ("Bánh mì burge", ["bánh mì"], ["sandwich"]),

    # --- Bánh Canh / Bánh Phở ---
    ("Bánh Canh", ["bánh canh"], []),
    ("Bánh Phở", ["bánh phở"], []),

    # --- Bánh phồng tôm ---
    ("Bánh phồng tôm", ["bánh phồng tôm"], []),

    # --- Bánh tráng ---
    ("Bánh tráng", ["bánh tráng"], []),

    # --- Bánh đa ---
    ("Bánh đa", ["bánh đa"], []),

    # --- Bánh ướt ---
    ("Bánh ướt", ["bánh ướt"], []),

    # --- Bí ngòi / bí đỏ ---
    ("Bí ngòi", ["bí ngòi"], []),
    ("Bí đỏ", ["bí đỏ"], []),

    # --- Chuối: tất cả về Chuối ---
    ("Chuối", ["chuối"], []),

    # --- Chanh: chỉ tách Chanh và Chanh dây ---
    ("Chanh dây", ["chanh dây"], []),
    ("Chanh", ["chanh"], ["dây"]),

    # --- Bột ớt: gộp các biến thể ---
    ("Bột ớt", ["bột ớt"], []),
    ("Bột ớt", ["ớt bột"], []),

    # --- Bột năng ---
    ("Bột năng", ["bột năng"], []),

    # --- Cà rốt ---
    ("Cà rốt", ["cà rốt"], []),

    # --- Chân nấm ---
    ("Chân nấm", ["chân nấm"], []),

    # --- Chả lụa chay / thường ---
    ("Chả lụa chay", ["chả lụa", "chay"], []),
    ("Chả lụa", ["chả lụa"], ["chay"]),

    # --- Cua đồng (cua xay) ---
    ("Cua đồng", ["cua đồng"], []),
    ("Cua đồng", ["cua xay"], []),

    # --- Cà chua bi / thường / băm / chín ---
    ("Cà chua bi", ["cà chua bi"], []),
    ("Cà chua", ["cà chua"], ["bi"]),

    # --- Cà pháo ---
    ("Cà pháo", ["cà pháo"], []),

    # --- Bì / Bong Bì: Bong Bì trước Bì để không gộp nhầm ---
    ("Bong Bì", ["bong bì"], []),
    ("Bì", ["bì"], ["bong"]),

    # --- Bột Cá / Bông Cải / Bông Hẹ / Bông Kim Châm / Bông So Đũa ---
    ("Bột Cá", ["bột cá"], []),
    ("Bông Cải", ["bông cải"], []),
    ("Bông Hẹ", ["bông hẹ"], []),
    ("Bông Kim Châm", ["bông kim châm"], []),
    ("Bông So Đũa", ["bông so đũa"], []),

    # --- Bơ: hai nhóm (Bơ trái / Bơ lạt). Thứ tự: trái quả trước, lạt sau ---
    ("Bơ trái", ["bơ", "trái"], []),
    ("Bơ trái", ["bơ", "quả"], []),
    ("Bơ lạt", ["bơ", "lạt"], []),
    ("Bơ lạt", ["bơ", "động vật"], []),
    ("Bơ lạt", ["bơ"], []),

    # --- Bưởi / Bạch Quả / Bạch Tuộc / Bầu ---
    ("Bưởi", ["bưởi"], []),
    ("Bạch Quả", ["bạch quả"], []),
    ("Bạch Tuộc", ["bạch tuộc"], []),
    ("Bầu", ["bầu"], []),

    # --- Bắp: Bắp Cải riêng, còn lại đổi thành Bắp Ngô. Thứ tự: Bắp Cải trước ---
    ("Bắp Cải", ["bắp cải"], []),
    ("Bắp Ngô", ["bắp"], []),
]


def detect_base_name(normalized_name: str) -> str | None:
    """
    Từ chuỗi đã normalize (lowercase, bỏ ký tự đặc biệt) suy ra tên base tiếng Việt.
    So khớp không phân biệt dấu (bỏ dấu khi so sánh) để gộp cả "bun"/"bún", "ba roi"/"ba rọi", "bac ha"/"bạc hà".
    Nếu không khớp rule nào thì trả về None.
    """
    s = normalized_name
    if not s:
        return None
    s_no_accents = strip_accents(s)

    for base, includes, excludes in BASE_RULES:
        inc_ok = all(strip_accents(inc) in s_no_accents for inc in includes)
        exc_ok = not any(strip_accents(exc) in s_no_accents for exc in excludes)
        if inc_ok and exc_ok:
            return base

    return None


def build_canonical_tables() -> Tuple[
    Dict[str, int], Dict[str, Tuple[int, str, str]]
]:
    """
    Trả về:
    - mapping_normkey_to_id: normalized_key -> ingredient_id
    - original_mapping: original_name -> (canonical_id, canonical_name, normalized_key)
    """
    # Đọc toàn bộ tên nguyên liệu duy nhất
    groups: Dict[str, List[str]] = defaultdict(
        list
    )  # group_key -> list original names
    group_key_to_base: Dict[str, str] = {}  # group_key -> base_name (nếu có)

    with open(INPUT_PATH, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            raw_name = (row.get("ingredient_name") or "").strip()
            if not raw_name:
                continue
            if is_invalid_ingredient(raw_name):
                # bỏ khỏi chuẩn hoá luôn
                continue
            norm_key = normalize_name(raw_name)
            if not norm_key:
                continue

            base = detect_base_name(norm_key)
            group_key = base.lower() if base else norm_key

            if raw_name not in groups[group_key]:
                groups[group_key].append(raw_name)
            if base:
                group_key_to_base[group_key] = base

    # Gán id cho từng nhóm
    mapping_normkey_to_id: Dict[str, int] = {}
    original_mapping: Dict[str, Tuple[int, str, str]] = {}

    current_id = 1
    for group_key, variants in sorted(groups.items(), key=lambda kv: kv[0]):
        # Nếu group có base_name thì ưu tiên dùng base làm canonical_name
        base_name = group_key_to_base.get(group_key)
        if base_name:
            canonical_name = base_name
        else:
            canonical_name = sorted(variants, key=lambda s: (len(s), s))[0]
        ingredient_id = current_id
        current_id += 1

        mapping_normkey_to_id[group_key] = ingredient_id
        for orig in variants:
            original_mapping[orig] = (ingredient_id, canonical_name, group_key)

    return mapping_normkey_to_id, original_mapping


def write_canonical_files(
    mapping_normkey_to_id: Dict[str, int],
    original_mapping: Dict[str, Tuple[int, str, str]],
):
    ensure_output_dir()

    # 1) Bảng nguyên liệu chuẩn
    canonical_path = os.path.join(OUTPUT_DIR, "ingredients_canonical.csv")
    norm_to_variants: Dict[str, List[str]] = defaultdict(list)
    for orig, (_, _canonical, norm) in original_mapping.items():
        norm_to_variants[norm].append(orig)

    with open(canonical_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(
            ["ingredient_id", "canonical_name", "normalized_key", "variants_count"]
        )
        # cần một map norm_key -> canonical_name
        norm_to_canonical: Dict[str, str] = {}
        for orig, (cid, cname, norm) in original_mapping.items():
            norm_to_canonical[norm] = cname

        for norm_key, ingredient_id in sorted(
            mapping_normkey_to_id.items(), key=lambda kv: kv[1]
        ):
            cname = norm_to_canonical.get(norm_key, "")
            variants = sorted(set(norm_to_variants.get(norm_key, [])))
            writer.writerow([ingredient_id, cname, norm_key, len(variants)])

    # 2) Bảng ánh xạ tên gốc -> id chuẩn
    mapping_path = os.path.join(OUTPUT_DIR, "ingredients_original_mapping.csv")
    with open(mapping_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(
            ["original_name", "canonical_id", "canonical_name", "normalized_key"]
        )
        for orig, (cid, cname, norm) in sorted(
            original_mapping.items(), key=lambda kv: kv[0]
        ):
            writer.writerow([orig, cid, cname, norm])


def write_full_with_canonical_id(
    original_mapping: Dict[str, Tuple[int, str, str]]
):
    """
    Ghi lại toàn bộ dòng nguyên liệu (giống file input) nhưng thêm cột canonical_id.
    Nếu nguyên liệu bị coi là invalid thì canonical_id để trống.
    """
    ensure_output_dir()
    output_path = os.path.join(OUTPUT_DIR, "ingredients_with_canonical_id.csv")

    with open(INPUT_PATH, newline="", encoding="utf-8-sig") as fin, open(
        output_path, "w", newline="", encoding="utf-8"
    ) as fout:
        reader = csv.DictReader(fin)
        fieldnames = reader.fieldnames or []
        if "canonical_id" not in fieldnames:
            fieldnames = fieldnames + ["canonical_id"]
        writer = csv.DictWriter(fout, fieldnames=fieldnames)
        writer.writeheader()

        for row in reader:
            raw_name = (row.get("ingredient_name") or "").strip()
            if raw_name in original_mapping:
                cid, _cname, _norm = original_mapping[raw_name]
                row["canonical_id"] = cid
            else:
                # nguyên liệu lỗi hoặc không gom được nhóm
                row["canonical_id"] = ""
            writer.writerow(row)


def main():
    # Tránh in Unicode dễ lỗi console Windows cũ: chỉ log tiếng Anh đơn giản
    # In đường dẫn theo dạng ascii-safe để tránh lỗi encoding trên Windows
    try:
        input_display = INPUT_PATH.encode("ascii", "ignore").decode("ascii")
    except Exception:
        input_display = "<path>"
    try:
        output_display = OUTPUT_DIR.encode("ascii", "ignore").decode("ascii")
    except Exception:
        output_display = "<path>"

    print("Input:", input_display)
    print("Output dir:", output_display)
    mapping_normkey_to_id, original_mapping = build_canonical_tables()
    print("Number of canonical ingredient groups:", len(mapping_normkey_to_id))
    print("Number of original ingredient names (after filtering):", len(original_mapping))

    write_canonical_files(mapping_normkey_to_id, original_mapping)
    write_full_with_canonical_id(original_mapping)

    print("Generated files:")
    print("   - ingredients_canonical.csv")
    print("   - ingredients_original_mapping.csv")
    print("   - ingredients_with_canonical_id.csv")
    print("   in folder:", OUTPUT_DIR)


if __name__ == "__main__":
    main()

