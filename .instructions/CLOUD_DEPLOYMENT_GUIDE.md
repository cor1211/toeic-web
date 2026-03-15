# Hướng dẫn chi tiết Triển khai Cloud (Miễn phí 24/7)

Tài liệu này hướng dẫn bạn từng bước để đưa TOEIC Mastery lên môi trường cloud bằng **Supabase** (lưu trữ) và **Render** (chạy server).

---

## Bước 1: Thiết lập Supabase (Database & Storage)

1.  **Tạo Project:** Truy cập [supabase.com](https://supabase.com), đăng ký tài khoản và tạo một New Project.
2.  **Lấy Database URL:**
    *   Vào mục **Project Settings** (biểu tượng bánh răng) -> **Database**.
    *   Tìm phần **Connection string** -> Chọn tab **URI**.
    *   Copy đoạn mã có dạng: `postgresql://postgres.[ID]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`
    *   **Lưu ý:** Thay `[PASSWORD]` bằng mật khẩu database bạn đã đặt khi tạo project.
3.  **Tạo Storage Bucket:**
    *   Vào mục **Storage** (biểu tượng thùng chứa).
    *   Chọn **New bucket**. Đặt tên là `toeic-assets`.
    *   Chuyển bucket sang chế độ **Public** (quan trọng để có thể xem ảnh/audio trực tiếp).
4.  **Lấy API Keys:**
    *   Vào **Project Settings** -> **API**.
    *   Copy **Project URL** và **anon public** key (hoặc service_role key nếu cần quyền ghi cao hơn).

---

## Bước 2: Đẩy Code lên GitHub

1.  Tạo một Repository mới trên [GitHub](https://github.com).
2.  Mở terminal tại máy tính của bạn (`d:\học\Tài Liệu CNTT\Tools\toeic-web2`):
    ```bash
    git init
    git add .
    git commit -m "Initial cloud ready version"
    git branch -M main
    git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
    git push -u origin main
    ```

---

## Bước 3: Triển khai lên Render

1.  Truy cập [render.com](https://render.com), đăng ký bằng tài khoản GitHub.
2.  Chọn **New+** -> **Blueprint**.
3.  Kết nối với Repository GitHub bạn vừa tạo.
4.  Render sẽ tự động đọc file `render.yaml` tôi đã tạo sẵn. Bạn sẽ thấy danh sách các biến môi trường cần điền:
    *   `DATABASE_URL`: Dán link PostgreSQL từ Bước 1 (Nhớ đổi giao thức thành `postgresql+asyncpg://...`).
    *   `SUPABASE_URL`: URL project Supabase của bạn.
    *   `SUPABASE_KEY`: Key API từ Bước 1.
    *   `STORAGE_MODE`: Đặt là `CLOUD`.
    *   `SUPABASE_BUCKET`: Đặt là `toeic-assets`.
5.  Nhấn **Apply**. Đợi khoảng 3-5 phút để Render build Docker và khởi chạy server.

---

## Bước 4: Kiểm tra và Sử dụng

1.  Sau khi Render báo **Live**, bạn sẽ có một địa chỉ web dạng `https://toeic-mastery.onrender.com`.
2.  Truy cập vào đó từ bất kỳ thiết bị nào (điện thoại, máy tính bảng).
3.  Thực hiện Import một file HTML mẫu.
4.  Kiểm tra trên Dashboard của Supabase:
    *   Mục **Table Editor** -> Xem bảng `exams`, `questions` xem dữ liệu đã vào chưa.
    *   Mục **Storage** -> Xem folder `images/` và `audio/` xem file đã được tải lên chưa.

---

## Một số lưu ý quan trọng:
-   **Render Free Tier:** Sau 15 phút không có người truy cập, server sẽ tự "ngủ". Lần truy cập tiếp theo sẽ mất khoảng 30s để khởi động lại.
-   **Link Database:** Render yêu cầu thư viện `asyncpg` để chạy async, nên bắt buộc link DB phải bắt đầu bằng `postgresql+asyncpg://`.
-   **Bảo mật:** Đừng bao giờ chia sẻ file `.env` hoặc các keys trong file code công khai. Các biến môi trường trên Render là cách an toàn nhất để quản lý chúng.
