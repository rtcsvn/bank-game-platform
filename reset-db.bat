@echo off
title Bank Game Platform - Reset DB
echo [CANH BAO] Lenh nay se XOA TOAN BO du lieu va seed lai!
echo.
set /p confirm=Ban chac chan? (go "yes" de tiep tuc): 
if /i "%confirm%" neq "yes" (
    echo Da huy.
    pause
    exit /b 0
)

echo Dang reset database...
docker exec bgp-api sh -c "npx prisma migrate reset --force && npx tsx prisma/seed.ts && npx tsx prisma/mock-seed.ts"
echo.
echo Hoan tat! Du lieu da duoc tao lai.
pause
