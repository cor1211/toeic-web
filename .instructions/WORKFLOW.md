# Development Workflow & Coding Standards

## 1. Git Strategy (Standard Flow)
- **Main Branch:** Code production chuẩn.
- **Develop Branch:** Code tích hợp tính năng mới.
- **Feature Branches:** `feat/feature-name`, `fix/bug-name`, `refactor/component-name`.

## 2. Conventional Commits
Tất cả commit message phải tuân thủ:
- `feat`: Tính năng mới.
- `fix`: Sửa lỗi.
- `docs`: Cập nhật tài liệu.
- `test`: Thêm/sửa unit test.
- **Ví dụ:** `feat(scoring): implement TOEIC conversion logic for listening part`

## 3. Quality Assurance
- **Testing:** Yêu cầu viết Unit Test cho logic tính điểm (Pytest). Coverage > 80%.
- **Linting/Formatting:** Tuân thủ PEP 8 (Sử dụng `ruff` hoặc `black`).
- **Documentation:** Mọi function phải có Docstrings theo chuẩn Google Style.