# Sistem Logları Yönetimi (Audit Logs)

Bu özellik, sistemde yapılan kritik işlemlerin (giriş yapma, personel silme, vardiya kaydetme vb.) kaydedilmesi ve admin panelinden Excel/CSV olarak indirilebilmesini sağlayacak.

## Kullanıcı Onayı Gerekenler

> [!IMPORTANT]
> Bu plan veritabanına yeni bir tablo eklenmesini ve sol menüye yeni bir sayfa (Sistem Logları) eklenmesini içerir. Onaylıyor musunuz?

## Yapılacak Değişiklikler

### 1. Veritabanı Değişiklikleri
- **[YENİ TABLO]** `system_logs`
  - `id` (UUID, Primary Key)
  - `created_at` (Timestamp)
  - `user_id` (Text/UUID - İşlemi yapan kişi)
  - `user_name` (Text - İşlemi yapan kişinin adı)
  - `action_type` (Text - Örn: 'GİRİŞ_YAPILDI', 'PERSONEL_SİLİNDİ')
  - `details` (Text - Detaylı bilgi)

### 2. Frontend Değişiklikleri

#### [YENİ] `src/utils/logger.ts`
- Sisteme log yazmak için kullanılacak merkezi bir yardımcı fonksiyon.

#### [YENİ] `src/pages/admin/SystemLogs.tsx`
- Logların listelendiği, arama yapılabildiği ve "Excel'e Aktar" butonunun olduğu yeni admin sayfası.

#### [DEĞİŞTİRİLECEK] `src/components/AdminLayout.tsx`
- Sol menüye "Sistem Logları" sekmesinin eklenmesi.

#### [DEĞİŞTİRİLECEK] Çeşitli Sayfalar (Login.tsx, PersonnelManagement.tsx)
- Sisteme giriş yapıldığında veya personel silindiğinde log fonksiyonunun çağrılması.

## Doğrulama Planı
1. Admin hesabıyla sisteme girip `system_logs` tablosuna log atıldığını test etme.
2. "Sistem Logları" sayfasına girip tabloyu görüntüleme.
3. Excel olarak indirme özelliğinin test edilmesi.
