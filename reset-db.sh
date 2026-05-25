#!/bin/bash
echo "⚠️  Lệnh này sẽ XÓA TOÀN BỘ dữ liệu và seed lại!"
read -p "Bạn chắc chắn? (gõ 'yes' để tiếp tục): " confirm
if [ "$confirm" != "yes" ]; then echo "Đã hủy."; exit 0; fi

echo "🔄 Đang reset database..."
docker exec bgp-api sh -c "npx prisma migrate reset --force && npx tsx prisma/seed.ts && npx tsx prisma/mock-seed.ts"
echo "✅ Hoàn tất! Dữ liệu đã được tạo lại."
