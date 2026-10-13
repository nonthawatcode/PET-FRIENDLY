# PET-FRIENDLY Backoffice

ระบบหลังบ้านสำหรับแพ็กสินค้า ดูออเดอร์ และจัดการสต็อกของร้าน PET-FRIENDLY (Shopee / Lazada / TikTok Shop)
ใช้ภายในร้านเท่านั้น ไม่ใช่หน้าร้านหรือ POS · บรีฟต้นฉบับอยู่ที่ [`docs/brief.md`](docs/brief.md)

**Stack:** Next.js 15 (App Router) · Supabase (Postgres, Auth, Realtime, Storage) · deploy บน Vercel

## เมนู

| เมนู | ทำอะไร |
|---|---|
| **แพ็ก** (หน้าแรก) | สถานีแพ็ก 4 ขั้น: สแกนใบปะหน้า → สแกน Data Matrix สินค้าทุกชิ้น → ยืนยันแพ็ก (ตัดสต็อก) → พร้อมส่ง · คิวรอแพ็ก · ตัวเลขสรุปวันนี้ |
| **ออเดอร์** | ค้นหาจากเลขออเดอร์ เลขพัสดุ หรือชื่อ · กรองสถานะ ช่องทาง และช่วงวันที่ · ดูรายละเอียดและประวัติ · คืนสต็อก (แพ็กผิด) · บันทึกสินค้าคืน · ส่งมอบขนส่ง |
| **สต็อก** | การ์ดสินค้า (ในคลัง / จอง / พร้อมขาย) · รับเข้า · แก้ไขสต็อกพร้อมเหตุผล · ผูก SKU ของ Marketplace · Data Matrix (ตั้งสี กลับสีได้ ดาวน์โหลด SVG/PNG) · ประวัติความเคลื่อนไหว |
| **บัญชี** | ชื่อผู้ใช้ · สถานะการเชื่อม Marketplace · สร้างออเดอร์ตัวอย่าง · เชิญ/ปิดบัญชีพนักงาน · เปลี่ยนโลโก้ · โหมดสว่าง/มืด |

## กติกาสต็อก (บังคับในฐานข้อมูล)

- ออเดอร์เข้ามา → **จอง** (Reserved +) โดยไม่ลดของในคลัง · พร้อมขาย = ในคลัง − จอง
- **ยืนยันแพ็ก** → ลดของในคลังและปลดยอดจอง **ครั้งเดียว** ยืนยันซ้ำหรือซิงก์ซ้ำจะไม่ตัดซ้ำ
- สแกนใบปะหน้าอย่างเดียว **ไม่ตัดสต็อก** · จำนวนที่สแกนต้องตรงกับออเดอร์ทุกชิ้น
- ยกเลิกก่อนแพ็ก → ปลดยอดจอง · ยกเลิกหลังแพ็ก → ติดธงให้รับของคืน แล้วบันทึกว่าคืนเข้าสต็อกหรือชำรุด
- SKU ภายในแก้ไม่ได้หลังสร้าง (เพราะพิมพ์ลง Data Matrix บนบรรจุภัณฑ์)
- ทุกการเปลี่ยนแปลงสต็อกมีบันทึก (เวลา ผู้ทำ เหตุผล) และลบไม่ได้ พนักงานแก้ตัวเลขสต็อกตรง ๆ ไม่ได้ ต้องผ่านฟังก์ชันที่ตรวจกติกาเท่านั้น

รายละเอียดอยู่ใน [`supabase/migrations/20261013000000_init.sql`](supabase/migrations/20261013000000_init.sql) และชุดทดสอบ [`tests/db/stock_rules.sql`](tests/db/stock_rules.sql)

## สถานะตอนนี้

**ใช้งานได้แล้ว (ทดสอบกับออเดอร์ตัวอย่าง):** ล็อกอินหลายผู้ใช้ · สถานีแพ็กครบ 4 ขั้น · จอง/ตัด/คืน/ปรับสต็อก · ผูก SKU · ออเดอร์ที่ SKU ไม่ตรง · ยกเลิก · สินค้าคืน · Data Matrix · อัปเดตอัตโนมัติเมื่อมีออเดอร์ใหม่หรือสต็อกเปลี่ยน (Realtime)

**รอข้อมูล/สิทธิ์จริง:**
- ดึงออเดอร์อัตโนมัติจาก Shopee / Lazada / TikTok Shop — รอสิทธิ์ API แล้วจะเขียนตัวเชื่อม (adapter) ที่เรียก `ingest_order()` ซึ่งรองรับการรับออเดอร์ซ้ำและการยกเลิกไว้แล้ว
- นำเข้าไฟล์ออเดอร์จาก Seller Center — รอไฟล์ตัวอย่างจริง
- ทดสอบกับเครื่องสแกนและใบปะหน้าจริง (บาร์โค้ดบนใบปะหน้าต้องตรงกับเลขพัสดุหรือเลขออเดอร์ ถ้าไม่ตรงกด “ผูก” ที่สถานีแพ็กได้)

## ติดตั้งครั้งแรก

### 1. Supabase
1. สร้างโปรเจกต์ที่ [supabase.com](https://supabase.com) เลือก region **Singapore**
2. รัน migration: ใช้ Supabase CLI `supabase link --project-ref <ref>` แล้ว `supabase db push`
   (หรือคัดลอกไฟล์ใน `supabase/migrations/` ไปวางใน SQL Editor แล้วรัน)
3. ถ้าต้องการข้อมูลเริ่มต้น 3 SKU ให้รัน `supabase/seed.sql` ใน SQL Editor
4. **Authentication → Sign In / Providers:** ปิด “Allow new users to sign up” (พนักงานเข้าได้ทางคำเชิญเท่านั้น)
5. **Authentication → URL Configuration:** ตั้ง Site URL เป็นโดเมนบน Vercel
6. **Authentication → Emails → Invite user และ Reset password:** เปลี่ยนลิงก์ในเทมเพลตเป็น
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite` (สำหรับ reset ใช้ `type=recovery`)
7. สร้างบัญชีแรก: **Authentication → Users → Invite user** ใส่อีเมลตัวเอง แล้วกดลิงก์ในอีเมลเพื่อตั้งรหัสผ่าน

### 2. Vercel
1. Import repo นี้ใน Vercel
2. ตั้ง Environment Variables ตาม [`.env.example`](.env.example):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (ห้ามใส่ใน NEXT_PUBLIC)
3. Deploy

> ใช้งานจริงเชิงพาณิชย์ควรใช้ Vercel Pro และ Supabase Pro (แพ็กเกจฟรีของ Vercel ห้ามใช้เชิงพาณิชย์ และโปรเจกต์ฟรีของ Supabase จะหยุดเมื่อไม่มีการใช้งาน 7 วัน)

## พัฒนาในเครื่อง

```bash
npm install
cp .env.example .env.local   # ใส่ค่าจากโปรเจกต์ Supabase
npm run dev                  # http://localhost:3000
npm run typecheck
npm run test:db              # ต้องมี Postgres ในเครื่อง (ใช้ PGHOST/PGUSER ตามปกติ)
```

`npm run test:db` สร้างฐานข้อมูลชั่วคราว รัน migration + seed แล้วทดสอบกติกาสต็อก 41 ข้อ
