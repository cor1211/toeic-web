# Product Requirements Document: TOEIC 2-Skills Mastery App

## 1. Mục tiêu hệ thống
Xây dựng ứng dụng Python hỗ trợ luyện thi TOEIC Listening & Reading (2 kỹ năng) theo format chuẩn ETS, tập trung vào tính cá nhân hóa và tối ưu hóa lộ trình học.

## 2. Đối tượng sử dụng (User Personas)
- Người học cần luyện đề thi thử.
- Người học cần tập trung vào các Part cụ thể (Part 1-7).
- Hệ thống yêu cầu Agent xử lý logic chấm điểm chính xác theo thang điểm TOEIC.

## 3. Các tính năng cốt lõi (Core Features)
- **Practice Mode:** Làm bài theo từng Part (Phân rã từ Part 1 đến Part 7).
- **Exam Mode:** Mô phỏng bài thi thật (200 câu - 120 phút).
- **Media Engine:** Xử lý audio (Listening) và hiển thị hình ảnh/văn bản (Reading) đồng bộ.
- **Analytics:** Thống kê lịch sử, tính toán điểm số dựa trên Conversion Table chuẩn.

## 4. Ràng buộc nghiệp vụ (Business Logic)
- **Scoring Engine:** Phải áp dụng thuật toán ánh số câu đúng sang thang điểm 5-495 cho mỗi kỹ năng.
- **Data Integrity:** Dữ liệu câu hỏi (JSON/SQL) phải phân tách rõ ràng giữa: Đề bài, Lựa chọn, Đáp án, Giải thích, và Metadata (Level, Part).