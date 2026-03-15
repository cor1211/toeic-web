# System Architecture & Design Patterns

## 1. Tech Stack
- **Language:** Python 3.10+.
- **Backend/API:** FastAPI.
- **Database:** SQLite với SQLAlchemy.
- **UI/Frontend:** Tùy chọn linh hoạt, hiệu quả nhất web app.
- **Testing:** Pytest.
- **Storage:** Filesystem local cho HTML goc, audio upload va media assets.

## 2. Clean Architecture
- `domain`
  - Business entities: `Exam`, `ExamSection`, `Question`, `Choice`, `MediaAsset`, `Attempt`, `AttemptAnswer`, `StudyNote`, `Bookmark`, `ReviewTag`.
- `use_cases`
  - `ImportExamFromHtml`, `ListExams`, `GetExamDetail`, `CreateAttempt`, `SaveAttemptProgress`, `SubmitAttempt`, `SaveQuestionNote`, `ToggleBookmark`.
- `infrastructure`
  - SQLite repositories, file storage, NN24H HTML parser, DTO mappers.
- `api`
  - REST endpoints cho import, exam library, attempt lifecycle, notes, bookmarks.
- `ui`
  -  app cho `Exam Library`, `Attempt Mode`, `Review Workspace`.

## 3. Data Flow
1. User upload `html_file` va `audio_file` trong UI.
2. FastAPI nhan file, luu file goc vao local storage.
3. Parser NN24H doc HTML, trich xuat metadata de, cau hoi, choices, dap an, explanation, image assets.
4. Import use case chuan hoa du lieu va ghi vao SQLite.
5. UI doc du lieu tu API de hien thi thu vien de, cho phep lam bai, nop bai va review.
6. Attempt, note, bookmark va cac tag on tap duoc luu lai de phuc vu hoc tap lan sau.

## 4. Storage Layout
- `data/app.db`: SQLite database.
- `data/uploads/html/`: HTML goc do nguoi dung upload.
- `data/uploads/audio/`: audio goc do nguoi dung upload.
- `data/uploads/images/`: image assets trich xuat hoac sao chep tu HTML.

## 5. Database Schema
- Table `exams`
  - `id`, `title`, `slug`, `source_type`, `source_html_path`, `audio_asset_id`, `duration_seconds`, `question_count`, `tags`, `created_at`.
- Table `exam_sections`
  - `id`, `exam_id`, `title`, `part`, `order_index`, `instructions_html`.
- Table `media_assets`
  - `id`, `exam_id`, `question_id`, `asset_type`, `original_url`, `local_path`, `mime_type`, `checksum`.
- Table `questions`
  - `id`, `exam_id`, `section_id`, `order_index`, `source_dom_id`, `prompt_html`, `explanation_html`, `correct_choice_key`.
- Table `choices`
  - `id`, `question_id`, `choice_key`, `content_html`, `is_correct`.
- Table `attempts`
  - `id`, `exam_id`, `started_at`, `submitted_at`, `status`, `elapsed_seconds`, `correct_count`, `incorrect_count`, `flagged_count`, `raw_score`.
- Table `attempt_answers`
  - `id`, `attempt_id`, `question_id`, `selected_choice_key`, `is_correct`, `flagged`, `elapsed_seconds`.
- Table `study_notes`
  - `id`, `question_id`, `content`, `updated_at`.
- Table `bookmarks`
  - `id`, `question_id`, `created_at`.
- Table `review_tags`
  - `id`, `question_id`, `tag`, `created_at`.

## 6. API Surface
- `POST /imports/exams`
  - Multipart upload: `html_file`, `audio_file`, optional `title`, `part`, `tags`.
- `GET /exams`
- `GET /exams/{exam_id}`
- `POST /attempts`
- `PATCH /attempts/{attempt_id}`
- `POST /attempts/{attempt_id}/submit`
- `POST /questions/{question_id}/notes`
- `POST /questions/{question_id}/bookmark`

## 7. UI Modules
- `Exam Library`
  - Danh sach de da import, thong tin so cau, audio status, tags.
- `Attempt Mode`
  - Audio player, question navigator, answer sheet, flag cau kho, autosave progress.
- `Review Workspace`
  - Ket qua dung/sai, explanation, note, bookmark, filter `sai`, `can on`, `da note`.

## 8. Parser Strategy
- Parser v1 chi nham toi cau truc HTML NN24H hien tai.
- Nguon du lieu uu tien la HTML da render san, khong phu thuoc vao API web goc.
- Loai bo script/style/noise de tranh duplicate question block.
- Neu HTML khong chua audio URL thi van import thanh cong vi audio luon duoc user upload rieng.
