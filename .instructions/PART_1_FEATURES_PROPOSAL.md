# PART 1 - FEATURE SPEC (BẢN HOÀN CHỈNH CHO AGENT TRIỂN KHAI)

## 1. Mục tiêu Part 1
Tăng hiệu quả học và trải nghiệm thao tác nhanh cho người dùng TOEIC 2 kỹ năng, dựa trên hệ thống đang chạy ổn định hiện tại.

Trọng tâm Part 1 gồm 2 nhóm tính năng:
1. Điều khiển audio bằng phím tắt toàn cục, không phụ thuộc focus vào thẻ audio.
2. Flashcard đa năng: cho phép tạo flashcard từ từ/cụm từ được chọn ở màn review và mở rộng dùng cho Part 1-7.

## 2. Hiện trạng hệ thống (đã có)
Từ code hiện tại, hệ thống đã vận hành tốt các luồng chính:
- Import đề NN24H từ file HTML hoặc nội dung dán.
- Tải và lưu audio, ảnh, câu hỏi, đáp án, giải thích.
- Làm bài (Attempt), tự lưu tiến độ mỗi 30 giây, nộp bài, chấm điểm theo % đúng.
- Review kết quả, filter đúng/sai/chưa làm, bookmark và ghi chú theo câu.

=> Part 1 không phá vỡ các chức năng cũ, chỉ mở rộng trải nghiệm học.

## 3. Feature A - Audio Shortcut Toàn Cục

### 3.1 Vấn đề người dùng
Người học đang cần thao tác audio nhanh khi làm bài/review, nhưng hiện tại:
- Arrow Left/Right đã dùng cho chuyển câu ở trang làm bài.
- Chưa có chuẩn chung để tua audio mà không click vào thanh audio trước.

### 3.2 Hành vi mong muốn
Khi trang có audio player hiển thị (Attempt hoặc Review):
- Space: Play/Pause audio.
- ArrowRight: tua +5 giây.
- ArrowLeft: tua -5 giây.

Điều kiện bắt buộc:
- Có hiệu lực dù audio chưa được focus/click.
- Không kích hoạt khi user đang gõ trong input/textarea/contenteditable.
- Khi không có audio, phím hoạt động theo logic cũ.

### 3.3 Quy tắc tránh xung đột phím
Để không phá hành vi chuyển câu hiện có:
- Ưu tiên audio shortcut khi audio đang tồn tại trên trang.
- Nếu muốn giữ điều hướng câu bằng mũi tên, chuyển điều hướng câu sang:
	- Alt + ArrowLeft: câu trước
	- Alt + ArrowRight: câu sau

Lưu ý: Agent có thể chọn phương án khác, nhưng phải đảm bảo tính nhất quán và có thông báo hướng dẫn phím trong UI.

### 3.4 Tiêu chí nghiệm thu (Acceptance Criteria)
1. Ở trang làm bài có audio, bấm Space phát/tạm dừng ngay, không cần click audio trước.
2. Ở trang review có audio, bấm ArrowRight tua +5s, ArrowLeft tua -5s.
3. Khi con trỏ ở textarea ghi chú, phím tắt audio không tự kích hoạt.
4. Không phát sinh lỗi JS trên console khi audio chưa load xong hoặc không có audio.

---

## 4. Feature B - Flashcard Đa Năng Từ Nội Dung Chọn

### 4.1 Mục tiêu học tập
Cho phép người học biến lỗi sai, từ vựng mới, cụm từ hay gặp thành bộ ôn tập lặp lại (spaced repetition) ngay trong app.

### 4.2 User Story
1. Là người học, tôi muốn bôi đen từ/cụm từ trong review để thêm nhanh vào flashcard.
2. Là người học, tôi muốn quản lý flashcard theo deck/chủ đề (Part, tag, đề thi).
3. Là người học, tôi muốn ôn tập flashcard định kỳ và đánh dấu mức độ nhớ.

### 4.3 Nguồn tạo flashcard
Tạo từ các bối cảnh sau:
- Prompt câu hỏi.
- Nội dung lựa chọn đáp án.
- Explanation.
- Ghi chú cá nhân.

Phạm vi áp dụng: Part 1 đến Part 7.

### 4.4 Trường dữ liệu flashcard
Mỗi flashcard tối thiểu gồm:
- id
- term (bắt buộc)
- meaning (cho phép rỗng lúc tạo nhanh)
- example (tùy chọn)
- source_type: question_prompt | choice | explanation | note | manual
- source_ref: exam_id, question_id, part (nếu có)
- tags (csv hoặc bảng quan hệ)
- deck_name (default: "Default")
- created_at, updated_at

Trường cho học lặp lại:
- next_review_at
- interval_days
- ease_factor
- repetition
- last_result: again | hard | good | easy

### 4.5 API đề xuất (mức MVP + mở rộng)
MVP:
- POST /flashcards
- GET /flashcards
- PATCH /flashcards/{id}
- DELETE /flashcards/{id}

Review flow:
- POST /flashcards/{id}/review
- GET /flashcards/review/due

Khuyến nghị bổ sung:
- POST /flashcards/from-selection
	- Input: selected_text, context_html(optional), exam_id, question_id, part, source_type, tags

### 4.6 Trải nghiệm UI bắt buộc
1. Trong trang Review:
	- User bôi đen text, hiện mini action "Thêm flashcard".
	- Click mở modal tạo nhanh (term điền sẵn từ vùng đã chọn).
2. Trang Flashcard:
	- Danh sách thẻ, tìm kiếm, filter theo deck/tag/part.
	- Chế độ ôn tập theo thẻ đến hạn.
3. Trong Review card:
	- Có nút "+ Flashcard" tại khu vực explanation/note nếu không muốn bôi đen.

### 4.7 Thuật toán ôn tập (khuyến nghị)
Sử dụng SM-2 rút gọn:
- Again: interval về 0-1 ngày.
- Hard: tăng nhẹ interval.
- Good: tăng chuẩn theo ease_factor.
- Easy: tăng mạnh hơn.

MVP có thể dùng bản đơn giản theo số ngày cố định, sau đó nâng cấp dần.

### 4.8 Tiêu chí nghiệm thu (Acceptance Criteria)
1. User có thể tạo flashcard từ text được bôi đen trong review trong <= 3 thao tác.
2. Flashcard lưu đúng liên kết nguồn (exam/question/part) nếu có.
3. User có thể xem danh sách flashcard và lọc theo ít nhất 1 chiều (tag hoặc deck).
4. User hoàn thành phiên ôn tập và hệ thống cập nhật next_review_at.
5. Không ảnh hưởng chức năng note/bookmark cũ.

---

## 5. Phi chức năng và an toàn dữ liệu
- Không thay đổi schema cũ theo kiểu phá hủy.
- Migration DB phải backward compatible.
- Giữ tốc độ phản hồi API hiện có; không để import hoặc review bị chậm rõ rệt.
- Escape/XSS-safe khi lưu và render nội dung text tự do.

## 6. Kế hoạch triển khai theo pha

### Pha 1 (nhanh, ít rủi ro)
- Bổ sung audio shortcut toàn cục.
- Bổ sung UI hint phím tắt.
- Thêm test tương tác cơ bản cho shortcut.

### Pha 2 (Flashcard MVP)
- Tạo bảng flashcards + CRUD API.
- Nút "Thêm flashcard" ở review (manual + selected text).
- Trang danh sách flashcard cơ bản.

### Pha 3 (Flashcard học lặp lại)
- Logic due cards + review result.
- Dashboard nhỏ: số thẻ đến hạn, tỷ lệ nhớ.

## 7. Định nghĩa hoàn thành Part 1 (Definition of Done)
1. Không regression ở import, attempt, submit, review, note, bookmark.
2. Đạt toàn bộ acceptance criteria của Feature A và Feature B.
3. Có hướng dẫn sử dụng ngắn cho người học trong UI hoặc docs.
4. Có test cho logic backend mới và luồng chính frontend.

## 8. Chỉ dẫn thực thi cho Agent
Khi agent thực thi Part 1, làm theo thứ tự:
1. Rà điểm móc hiện tại ở UI/route/API để thêm mà không phá code cũ.
2. Làm Feature A trước (ít phụ thuộc).
3. Tạo schema/API flashcard theo MVP.
4. Gắn UI review -> create flashcard.
5. Bổ sung review scheduler (nếu làm Pha 3).
6. Chạy test, tự kiểm tra hiệu năng và lỗi JS.

Quy tắc ưu tiên:
- Ưu tiên ổn định production.
- Ưu tiên thao tác nhanh cho người học.
- Ưu tiên thiết kế dữ liệu đủ mở rộng cho Part 1-7 lâu dài.