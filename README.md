# IELTS Vocabulary Learning Hub

📚 **Interactive offline IELTS vocabulary learning platform** phù hợp mục tiêu Band 7.5+ đến 8.5+

## 🎯 Tính Năng

- ✅ **Học Offline** - Không cần kết nối internet, tải về một lần dùng mãi
- ✅ **50+ Nhóm Từ Vựng** - Được phân loại chi tiết theo chủ đề 
- ✅ **Ghi Chú Cá Nhân** - Lưu giữ tự động trong trình duyệt (localStorage)
- ✅ **Copy Markdown/Excel** - Xuất dữ liệu để sử dụng với các công cụ khác
- ✅ **Tìm Kiếm Nhanh** - Tra cứu từ vựng, ý nghĩa, ví dụ và ghi chú
- ✅ **Responsive Design** - Hoạt động tốt trên desktop, tablet, mobile
- ✅ **Auto-Generate Config** - Thêm chủ đề mới mà không cần sửa config file
- ✅ **GitHub Actions** - Tự động publish lên GitHub Pages khi push code

## 📁 Cấu Trúc

```
.
├── index.html                    # Trang chủ - danh sách các chủ đề
├── 01 Weather.html              # Chủ đề: Thời tiết (15 nhóm)
├── 02 Travel.html               # Chủ đề: Du lịch & phát triển bền vững (14 nhóm)
├── 03 City.html                 # Chủ đề: Thành phố & nhà ở (22 nhóm)
├── data/
│   └── vocabularies.json        # Config danh sách chủ đề (⚠️ TỰ ĐỘNG SINH RA)
├── generate-vocab-config.js     # Script tự động sinh vocabularies.json
├── package.json                 # NPM config
├── .github/workflows/
│   └── generate-and-deploy.yml  # GitHub Actions workflow
├── .gitignore
└── README.md
```

### ⚠️ Về file `data/vocabularies.json`
- **Không sửa tay file này!** Nó được **tự động sinh ra** từ script `generate-vocab-config.js`
- Mỗi khi chạy script hoặc push lên GitHub, file này sẽ được update tự động
- Chứa danh sách tất cả các chủ đề, số nhóm từ vựng, mô tả, etc.

## 🚀 Cách Sử Dụng

### Trên Máy Tính
1. Tải thư mục này về máy
2. Mở file `index.html` bằng trình duyệt
3. Chọn chủ đề muốn học
4. Duyệt qua từ vựng, ghi chú nếu cần

### Cài Đặt Node.js (Tùy chọn - chỉ cần nếu thêm chủ đề mới)
Để sử dụng script tự động sinh `vocabularies.json`:
- Tải Node.js từ https://nodejs.org/ (phiên bản LTS)
- Mở Terminal/Command Prompt
- Chạy: `node --version` (kiểm tra cài đặt thành công)

### Trên GitHub Pages (Công Khai Online)
Website tự động được publish lên GitHub Pages khi bạn push code:

**Lần đầu tiên:**
1. Tạo repository GitHub mới (ví dụ: `ielts-vocab-hub`)
2. Clone về máy: `git clone https://github.com/your-username/ielts-vocab-hub.git`
3. Copy tất cả files vào thư mục này
4. Commit & push:
   ```bash
   git add .
   git commit -m "Initial commit: IELTS vocab hub"
   git branch -M main
   git push -u origin main
   ```

**Bật GitHub Pages:**
1. Vào Settings → Pages
2. Chọn "Deploy from a branch"
3. Source: `gh-pages` branch
4. Nhấn Save
5. Sau 1-2 phút, site sẽ available tại: `https://your-username.github.io/ielts-vocab-hub`

**Sau này:**
- Mỗi lần bạn `git push`, GitHub Actions tự động:
  1. Chạy `generate-vocab-config.js` → update `vocabularies.json`
  2. Commit file này về repo
  3. Deploy lên GitHub Pages
- Không cần làm gì thêm!

## ➕ Thêm Chủ Đề Mới — HOÀN TOÀN TỰ ĐỘNG ✨

Không cần sửa tay `vocabularies.json` nữa! Chỉ cần:

1. **Tạo file HTML mới** theo tên quy ước: `04 Topic.html`
   - Copy cấu trúc từ một file hiện có (ví dụ: `02 Travel.html`)
   - Thay đổi:
     - `<h1 id="mainTitle">` → tên chủ đề của bạn
     - `<p id="complexitySummarySection">` → mô tả chủ đề
     - `vocabData = [...]` → dữ liệu từ vựng của bạn

2. **Chạy script tự động**
   ```bash
   node generate-vocab-config.js
   ```
   Hoặc sử dụng npm:
   ```bash
   npm run generate
   ```

3. **Xong!** Trang chủ sẽ tự động hiển thị chủ đề mới 🎉

### Script hoạt động thế nào?
- Quét thư mục tìm các file HTML có tên `NN Topic.html` (NN = 01, 02, 03...)
- Tự động trích xuất:
  - Tiêu đề từ `<h1 id="mainTitle">`
  - Mô tả từ `<p id="complexitySummarySection">`
  - Số nhóm từ vựng bằng cách đếm `"no": X` trong mảng `vocabData`
- Tạo/cập nhật `data/vocabularies.json` tự động
- Không cần sửa file JSON hay index.html

## 💾 Dữ Liệu Ghi Chú

Ghi chú được lưu **cục bộ** trong trình duyệt của bạn:
- Mỗi chủ đề có key riêng: `vocabList_<chủ đề>`
- Dữ liệu tồn tại khi trình duyệt không xóa cache
- Để xóa ghi chú: Xóa dữ liệu trình duyệt hoặc clear localStorage

## 🛠️ Công Nghệ

- **Tailwind CSS** - Styling responsive
- **Vanilla JavaScript** - Không phụ thuộc framework
- **localStorage API** - Lưu ghi chú
- **GitHub Pages** - Hosting miễn phí

## 📝 Cấu Trúc Từ Vựng

Mỗi nhóm từ vựng bao gồm:
- **No.** - Số thứ tự
- **Vocab** - Từ vựng và phiên âm IPA
- **Meaning** - Giải thích tiếng Anh + Bản dịch Việt
- **Collocations** - Những cụm từ thường dùng
- **Examples** - Ví dụ minh họa
- **Synonyms/Antonyms** - Từ đồng/trái nghĩa
- **Notes** - Ghi chú cá nhân

## ⚙️ Tùy Chỉnh

Bạn có thể sửa các thông số trong HTML:
- Màu sắc Tailwind (indigo, slate, emerald, etc.)
- Font chữ (hiện dùng Inter từ Google Fonts)
- Số cột lưới (lg:grid-cols-3 = 3 cột trên desktop)

## 📄 License

Tài liệu học tập - Sử dụng cho mục đích cá nhân

## 💬 Ghi Chú

- Tài liệu tập trung IELTS Band 7.5+
- Phù hợp cho speaking, writing, listening, reading
- Collocation được chọn dựa trên tần suất xuất hiện trong đề IELTS
- Ví dụ được viết với tiêu chuẩn học thuật IELTS

---

**Happy Learning! 🎓**

Mỗi nhóm từ vựng được thiết kế để giúp bạn đạt mục tiêu điểm IELTS cao. Hãy học thường xuyên và ghi chú những điểm khó!
