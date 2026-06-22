#!/usr/bin/env python
"""
Áp dụng chỉnh sửa từ ingredients_canonical_clean.csv để tạo ra:
- ingredients_canonical_final.csv: bảng nguyên liệu chuẩn sau khi clean.
- ingredients_original_mapping_final.csv: mapping tên gốc -> id chuẩn (sau clean).
- ingredients_with_canonical_id_final.csv: bảng nguyên liệu theo món với canonical_id đã remap/xoá.

Quy tắc dựa trên file ingredients_canonical_clean.csv:
- Cột 'Trạng thái' (case-insensitive):
  + '' (rỗng hoặc null): giữ nguyên.
  + 'Sửa': sửa tên canonical_name theo cột 'Nội Dung'.
  + 'Xóa': xoá nguyên liệu đó khỏi bảng chuẩn và
          remap toàn bộ xuất hiện của ingredient_id này (trong mapping & recipe)
          sang id ở cột 'Mapping'.
  + 'Xóa vĩnh viễn': xoá nguyên liệu khỏi bảng chuẩn,
          đồng thời xoá luôn các dòng mapping & recipe sử dụng id này.

LƯU Ý:
- Script này KHÔNG sửa các file gốc; chỉ đọc:
  - ingredients_canonical_clean.csv
  - ingredients_original_mapping.csv
  - ingredients_with_canonical_id.csv
  và ghi ra các file *_final.csv mới trong cùng thư mục output.
"""

import csv
import os
from typing import Dict, Set


BASE_DIR = os.path.join(os.path.dirname(__file__), "ingredient_standardize_output")

CANONICAL_CLEAN_PATH = os.path.join(BASE_DIR, "ingredients_canonical_clean.csv")
ORIGINAL_MAPPING_PATH = os.path.join(BASE_DIR, "ingredients_original_mapping.csv")
RECIPE_ING_PATH = os.path.join(BASE_DIR, "ingredients_with_canonical_id.csv")

CANONICAL_FINAL_PATH = os.path.join(BASE_DIR, "ingredients_canonical_final.csv")
ORIGINAL_MAPPING_FINAL_PATH = os.path.join(
    BASE_DIR, "ingredients_original_mapping_final.csv"
)
RECIPE_ING_FINAL_PATH = os.path.join(
    BASE_DIR, "ingredients_with_canonical_id_final.csv"
)


def load_clean_instructions():
    """
    Đọc file ingredients_canonical_clean.csv, trả về:
    - canonical_rows: list raw dict (giữ thứ tự/cột gốc)
    - status_map: id -> (status, new_name, mapping_id|None)
    """
    canonical_rows = []
    status_map: Dict[int, Dict[str, object]] = {}

    with open(CANONICAL_CLEAN_PATH, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            canonical_rows.append(row)
            cid_raw = (row.get("ingredient_id") or "").strip()
            if not cid_raw:
                continue
            try:
                cid = int(cid_raw)
            except ValueError:
                continue

            status = (row.get("Trạng thái") or "").strip()
            content = (row.get("Nội Dung") or "").strip()
            mapping_raw = (row.get("Mapping") or "").strip()
            mapping_id = None
            if mapping_raw:
                try:
                    mapping_id = int(mapping_raw)
                except ValueError:
                    mapping_id = None

            status_map[cid] = {
                "status": status,
                "new_name": content,
                "mapping_id": mapping_id,
            }

    return canonical_rows, status_map


def build_action_sets(status_map):
    """
    Từ status_map (id -> status/new_name/mapping_id) sinh ra:
    - ids_delete_and_remap: set id cần Xóa (remap sang id khác)
    - ids_delete_forever: set id cần Xóa vĩnh viễn
    - rename_map: id -> new_name (cho trạng thái Sửa)
    - remap_target: id_nguon -> id_dich (cho Xóa)
    """
    ids_delete_and_remap: Set[int] = set()
    ids_delete_forever: Set[int] = set()
    rename_map: Dict[int, str] = {}
    remap_target: Dict[int, int] = {}

    for cid, info in status_map.items():
        status = (info.get("status") or "").strip().lower()
        new_name = (info.get("new_name") or "").strip()
        mapping_id = info.get("mapping_id")

        if not status:
            continue
        if status.startswith("sửa"):
            if new_name:
                rename_map[cid] = new_name
        elif status.startswith("xóa vĩnh viễn"):
            ids_delete_forever.add(cid)
        elif status.startswith("xóa"):
            # Xóa + remap bắt buộc cần mapping_id
            if mapping_id is not None:
                ids_delete_and_remap.add(cid)
                remap_target[cid] = mapping_id

    return ids_delete_and_remap, ids_delete_forever, rename_map, remap_target


def apply_to_canonical(canonical_rows, status_map):
    """
    Tạo bảng canonical_final từ canonical_clean + status.
    """
    (
        ids_delete_and_remap,
        ids_delete_forever,
        rename_map,
        _remap_target,
    ) = build_action_sets(status_map)

    with open(CANONICAL_FINAL_PATH, "w", newline="", encoding="utf-8") as f:
        fieldnames = ["ingredient_id", "canonical_name", "variants_count"]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for row in canonical_rows:
            cid_raw = (row.get("ingredient_id") or "").strip()
            if not cid_raw:
                continue
            try:
                cid = int(cid_raw)
            except ValueError:
                continue

            if cid in ids_delete_and_remap or cid in ids_delete_forever:
                # Bỏ khỏi bảng chuẩn
                continue

            canonical_name = row.get("canonical_name") or ""
            if cid in rename_map:
                canonical_name = rename_map[cid]

            writer.writerow(
                {
                    "ingredient_id": cid,
                    "canonical_name": canonical_name,
                    "variants_count": row.get("variants_count") or "",
                }
            )


def apply_to_original_mapping(status_map):
    """
    Tạo mapping_final từ ingredients_original_mapping.csv và status.
    """
    (
        ids_delete_and_remap,
        ids_delete_forever,
        rename_map,
        remap_target,
    ) = build_action_sets(status_map)

    with open(ORIGINAL_MAPPING_PATH, newline="", encoding="utf-8-sig") as fin, open(
        ORIGINAL_MAPPING_FINAL_PATH, "w", newline="", encoding="utf-8"
    ) as fout:
        reader = csv.DictReader(fin)
        fieldnames = reader.fieldnames or [
            "original_name",
            "canonical_id",
            "canonical_name",
            "normalized_key",
        ]
        writer = csv.DictWriter(fout, fieldnames=fieldnames)
        writer.writeheader()

        for row in reader:
            cid_raw = (row.get("canonical_id") or "").strip()
            if not cid_raw:
                continue
            try:
                cid = int(cid_raw)
            except ValueError:
                continue

            # Xóa vĩnh viễn: bỏ hoàn toàn
            if cid in ids_delete_forever:
                continue

            # Xóa + remap: chuyển sang id đích
            if cid in ids_delete_and_remap:
                target = remap_target.get(cid)
                if target is None:
                    continue
                cid = target

            # Áp dụng rename nếu có
            if cid in rename_map:
                row["canonical_name"] = rename_map[cid]

            row["canonical_id"] = cid
            writer.writerow(row)


def apply_to_recipe_ingredients(status_map):
    """
    Tạo ingredients_with_canonical_id_final.csv từ ingredients_with_canonical_id.csv
    theo rule clean.
    """
    (
        ids_delete_and_remap,
        ids_delete_forever,
        _rename_map,
        remap_target,
    ) = build_action_sets(status_map)

    with open(RECIPE_ING_PATH, newline="", encoding="utf-8-sig") as fin, open(
        RECIPE_ING_FINAL_PATH, "w", newline="", encoding="utf-8"
    ) as fout:
        reader = csv.DictReader(fin)
        fieldnames = reader.fieldnames or []
        writer = csv.DictWriter(fout, fieldnames=fieldnames)
        writer.writeheader()

        for row in reader:
            cid_raw = (row.get("canonical_id") or "").strip()
            if not cid_raw:
                # Không có canonical_id thì giữ nguyên
                writer.writerow(row)
                continue
            try:
                cid = int(cid_raw)
            except ValueError:
                writer.writerow(row)
                continue

            # Xóa vĩnh viễn: loại luôn dòng nguyên liệu này khỏi công thức
            if cid in ids_delete_forever:
                continue

            # Xóa + remap: gán sang id đích
            if cid in ids_delete_and_remap:
                target = remap_target.get(cid)
                if target is None:
                    continue
                cid = target

            row["canonical_id"] = cid
            writer.writerow(row)


def renumber_canonical_ids():
    """
    Đánh số lại ingredient_id trong ingredients_canonical_final.csv thành 1, 2, 3, ...
    và cập nhật canonical_id tương ứng trong hai file mapping.
    """
    # 1) Đọc canonical_final, gán id mới tăng dần
    rows = []
    fieldnames = []
    with open(CANONICAL_FINAL_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = list(reader.fieldnames or [])
        for row in reader:
            rows.append(row)

    old_to_new: Dict[int, int] = {}
    for i, row in enumerate(rows, start=1):
        old_raw = (row.get("ingredient_id") or "").strip()
        try:
            old_id = int(old_raw)
        except ValueError:
            continue
        old_to_new[old_id] = i
        row["ingredient_id"] = i

    # 2) Ghi lại canonical_final với id mới
    with open(CANONICAL_FINAL_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    # 3) Cập nhật ingredients_original_mapping_final.csv
    mapping_rows = []
    with open(ORIGINAL_MAPPING_FINAL_PATH, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        mf = reader.fieldnames or []
        for row in reader:
            cid_raw = (row.get("canonical_id") or "").strip()
            if cid_raw:
                try:
                    old_id = int(cid_raw)
                    row["canonical_id"] = old_to_new.get(old_id, old_id)
                except ValueError:
                    pass
            mapping_rows.append(row)

    with open(ORIGINAL_MAPPING_FINAL_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=mf)
        writer.writeheader()
        writer.writerows(mapping_rows)

    # 4) Cập nhật ingredients_with_canonical_id_final.csv
    recipe_rows = []
    with open(RECIPE_ING_FINAL_PATH, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        rf = reader.fieldnames or []
        for row in reader:
            cid_raw = (row.get("canonical_id") or "").strip()
            if cid_raw:
                try:
                    old_id = int(cid_raw)
                    row["canonical_id"] = old_to_new.get(old_id, old_id)
                except ValueError:
                    pass
            recipe_rows.append(row)

    with open(RECIPE_ING_FINAL_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=rf)
        writer.writeheader()
        writer.writerows(recipe_rows)

    print(f"- Renumbered {len(old_to_new)} canonical ids to 1..{len(old_to_new)} and updated mappings")


def main():
    print("Applying canonical clean instructions...")
    canonical_rows, status_map = load_clean_instructions()
    print(f"- Loaded {len(canonical_rows)} canonical rows with clean statuses")

    apply_to_canonical(canonical_rows, status_map)
    print(f"- Wrote canonical final -> {CANONICAL_FINAL_PATH}")

    apply_to_original_mapping(status_map)
    print(f"- Wrote original mapping final -> {ORIGINAL_MAPPING_FINAL_PATH}")

    apply_to_recipe_ingredients(status_map)
    print(f"- Wrote recipe ingredients final -> {RECIPE_ING_FINAL_PATH}")

    renumber_canonical_ids()

    print("Done.")


if __name__ == "__main__":
    main()

