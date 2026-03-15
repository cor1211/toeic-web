# Đề xuất Phát triển Tính năng (TOEIC Web App)
**Tập trung vào Part 1 (Photographs) và Khả năng Mở rộng (Part 2-7)**

Mục tiêu của ứng dụng không chỉ là một công cụ "làm bài tập mộc", mà là một **"Review Studio" (Không gian Ôn luyện)** chuyên sâu. Dựa trên bản chất của TOEIC Part 1 (Nghe mô tả tranh), sau đây là bản đề xuất các tính năng cốt lõi giúp tối ưu hóa việc học của người dùng, được thiết kế để dễ dàng mở rộng cho các phần khác trong tương lai.

---

## 1. Hệ thống Quản lý Audio Thông minh (Smart Audio Controls)
*Vấn đề: Đề thi thật thường chỉ có 1 file audio dài 45-60 phút. Người học mất rất nhiều thời gian "tua" để tìm lại đúng đoạn audio của câu bị sai.*

### Tính năng Đề xuất:
- **Cắt/Gắn mốc Audio (Audio Timestamping/Slicing):**
  - **Mô tả:** Cho phép người dùng (hoặc hệ thống tự động nhận diện khoảng lặng) gắn thẻ timestamp (thời gian bắt đầu - kết thúc) cho từng câu hỏi.
  - **Trải nghiệm Review:** Khi xem lại Câu 1 bị sai, sẽ có sẵn nút `[▶] Nghe lại câu này` – chỉ phát đúng 15 giây audio của câu đó.
  - **Mở rộng (Part 2-4):** Cực kỳ quan trọng cho Part 2 (Nghe phản xạ nhanh) và Part 3, 4 (Đoạn hội thoại).
- **Audio Looping & Speed Control:**
  - **Mô tả:** Nút "Lặp lại liên tục" (Loop) đoạn audio của 1 câu để luyện nghe chép chính tả (Dictation). Tích hợp tăng/giảm tốc độ (0.8x - 1.2x - 1.5x) cho người muốn luyện nghe bắt âm.

## 2. Interactive Transcript (Đoạn trích Tương tác)
*Vấn đề: Part 1 trên giấy không có chữ. Khi review, người học chỉ đọc giải thích tĩnh.*

### Tính năng Đề xuất:
- **Click-to-play Transcript:**
  - **Mô tả:** Trong chế độ Review, hiển thị Transcript (Lời thoại) dưới dạng: `(A) [Câu A]`, `(B) [Câu B]`, `(C) [Câu C]`, `(D) [Câu D]`.
  - Khi người dùng click vào dòng `(B)`, audio sẽ chỉ phát đúng câu B. Điều này giúp luyện nghe phân biệt giữa âm và chữ.
  - **Mở rộng:** Hữu ích cho Part 2 (Click từng đáp án A, B, C để nghe) và Part 3, 4 (Click vào từng câu trong đoạn văn để nghe lời thoại tương ứng).
- **Shadowing Mode:**
  - **Mô tả:** Che/Hiện (Toggle) cụm từ, yêu cầu người học nhại lại (Shadowing) theo giọng đọc.

## 3. Phân tích Các "Bẫy" (Distractor Analysis)
*Vấn đề: Học sinh thường lặp lại lỗi sai vì không hiểu "tại sao câu kia lại sai".*

### Tính năng Đề xuất:
- **Gắn Tag Lỗi Nhận Thức (Error Tagging):**
  - **Mô tả:** Part 1 thường có 4 loại bẫy kinh điển. Cho phép hệ thống hoặc người dùng gắn tag cho từng câu sai:
    - 🏷️ `Sai Hành động (Wrong Action)`
    - 🏷️ `Sai Chủ thể (Wrong Subject)`
    - 🏷️ `Sai Vị trí (Wrong Location)`
    - 🏷️ `Âm tương tự (Similar-sounding Words)`
  - **Trải nghiệm Review:** Thêm một filter trong Dashboard: *"Hiển thị tất cả các câu tôi sập bẫy 'Tự suy diễn' trong tuần qua"*.
  - **Mở rộng (Part 2, 5, 6, 7):** Part 2 có bẫy Yes/No Question, Same Word. Part 5 có bẫy Word Form, Collocation. Hệ thống tag này sẽ là cốt lõi cho mọi Part.

## 4. Tương tác Hình ảnh Nâng cao (Advanced Image Interaction)
*Vấn đề: Hình ảnh tĩnh đôi khi không tập trung được sự chú ý vào từ vựng.*

### Tính năng Đề xuất:
- **Hotspot Highlighting (Tính năng Review):**
  - **Mô tả:** Cho phép người click/vẽ vùng đánh dấu trên bức ảnh để ghi chú từ vựng trực tiếp lên ảnh. Vd: khoanh tròn người đàn ông → ghi chú `adjusting the microphone`.
  - **Tính năng Flashcard Hình ảnh:** Ẩn chú thích và yêu cầu người dùng miêu tả bức ảnh trước khi click để hiện đáp án thực tế.
  - **Mở rộng:** Trong Part 7 (Đọc hiểu), tính năng này tương đương với việc "Highlight dẫn chứng" (Khoanh màu vàng đoạn văn tương ứng với đáp án câu 150).

## 5. Vocabulary Extraction & Spaced Repetition (SRS)
*Vấn đề: Gặp từ mới trong một câu → Tra từ điển → Quên.*

### Tính năng Đề xuất:
- **One-click Dictionary & Add to Deck:**
  - **Mô tả:** Trong phần lời giải, click đúp vào một từ bất kỳ → Hiện tooltip nghĩa Tiếng Việt → Nút `[+] Lưu vào sổ tay`.
  - **Bổ trợ:** Kết hợp với một thuật toán Spaced Repetition thu gọn (như Anki). Dashboard sẽ hiện nhắc nhở: *"Bạn có 15 từ vựng Part 1 cần ôn tập hôm nay"*.
  - **Mở rộng (Tất cả Part):** Tính năng xương sống của quá trình mở rộng vốn từ vựng TOEIC.

---

## Tóm tắt Lộ trình Đề xuất (Roadmap)

**Giai đoạn 2 (Ngay sau Phase 1 hiện tại): Tập trung vào Review Experience**
1. Xây dựng Data Model cho Timestamp (Mỗi `Question` hoặc `Choice` lưu `audio_start_time`, `audio_end_time`).
2. Tích hợp UI Audio Player có khả năng tua đến chính xác Timestamp.
3. Ra mắt tính năng **Interactive Transcript** (Click chữ phát âm thanh).

**Giai đoạn 3: Phân tích sâu & Cá nhân hóa**
1. Bổ sung `Error Tagging` vào hệ thống (Người dùng tự tag lỗi tại sao họ sai).
2. Tách từ vựng từ `explanation_html` thành các Entity độc lập (`VocabularyCard`).
3. View tổng hợp (Analytics): Điểm yếu của tôi nằm ở dạng bẫy nào? (Dạng biểu đồ Spider Chart).

**Giai đoạn 4: Reading & Highlight**
1. Mở rộng UI cho Part 7 (Passages dọc bên trái, Questions dọc bên phải).
2. Tính năng Highlight Text để gạch chân dẫn chứng.
3. Liên kết màu sắc giữa Câu hỏi và Dẫn chứng trong bài đọc.

---
Bản đề xuất này sử dụng chung một tư duy lõi: **"Chia nhỏ dữ liệu rời rạc (Audio/Text/Image) thành các đoạn tương tác vi mô (Micro-interactions)"** để tối đa hóa hiệu suất học, tránh tình trạng đọc giải thích tĩnh thụ động truyền thống.
