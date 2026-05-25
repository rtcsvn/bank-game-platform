#!/bin/bash
set -e

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

clear
echo -e "${BOLD}${RED}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║         BANK GAME PLATFORM — LOCAL DEPLOY               ║"
echo "║         macOS Setup Script                              ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ── 1. Kiểm tra Docker ──────────────────────────────────────
echo -e "${YELLOW}[1/6] Kiểm tra Docker...${NC}"
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}[LỖI] Docker chưa chạy! Mở Docker Desktop rồi thử lại.${NC}"
  open -a Docker 2>/dev/null || true
  echo "Đang chờ Docker khởi động (30s)..."
  sleep 30
  if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Docker vẫn chưa sẵn sàng. Hãy mở Docker Desktop thủ công.${NC}"
    exit 1
  fi
fi
echo -e "${GREEN}✓ Docker đang chạy${NC}"

# ── 2. Kiểm tra Node.js ─────────────────────────────────────
echo -e "${YELLOW}[2/6] Kiểm tra Node.js...${NC}"
if ! node --version > /dev/null 2>&1; then
  echo -e "${RED}[LỖI] Node.js chưa cài. Tải tại: https://nodejs.org${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Node.js $(node --version) sẵn sàng${NC}"

# ── 3. Dừng container cũ ────────────────────────────────────
echo -e "${YELLOW}[3/6] Dừng container cũ (nếu có)...${NC}"
docker-compose down --remove-orphans > /dev/null 2>&1 || true
echo -e "${GREEN}✓ Đã dọn dẹp${NC}"

# ── 4. Build & start backend services ───────────────────────
echo -e "${YELLOW}[4/6] Build và khởi động PostgreSQL + Redis + API + Worker...${NC}"
docker-compose up -d --build postgres redis api worker adminer
echo -e "${GREEN}✓ Container đã start, đang chờ khởi động...${NC}"

# Chờ API health check
echo -n "    Đang chờ API sẵn sàng "
for i in $(seq 1 60); do
  if curl -s http://localhost:4000/health > /dev/null 2>&1; then
    echo -e "\n${GREEN}✓ API sẵn sàng tại http://localhost:4000${NC}"
    break
  fi
  echo -n "."
  sleep 2
  if [ $i -eq 60 ]; then
    echo -e "\n${RED}API không phản hồi sau 120s. Xem log: docker logs bgp-api${NC}"
    exit 1
  fi
done

# ── 5. Cài và chạy Frontend ─────────────────────────────────
echo -e "${YELLOW}[5/6] Cài npm packages và khởi động Frontend...${NC}"
cd frontend
if [ ! -d "node_modules" ]; then
  echo "    Cài npm packages lần đầu (1-2 phút)..."
  npm install --silent
fi
# Chạy Vite dev server trong tab Terminal mới
osascript -e 'tell application "Terminal" to do script "cd '"$(pwd)"' && npm run dev"' 2>/dev/null || \
  npm run dev &
cd ..
echo -e "${GREEN}✓ Frontend đang khởi động...${NC}"
sleep 4

# ── 6. Mở trình duyệt ───────────────────────────────────────
echo -e "${YELLOW}[6/6] Mở trình duyệt...${NC}"
open http://localhost:5173 2>/dev/null || true
open http://localhost:8080 2>/dev/null || true

# ── Done ─────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║               KHỞI ĐỘNG THÀNH CÔNG! 🎉                  ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║                                                          ║"
echo "║  🖥  Frontend (Admin UI)   →  http://localhost:5173     ║"
echo "║  🔌  Backend API           →  http://localhost:4000     ║"
echo "║  🗄  Database UI (Adminer) →  http://localhost:8080     ║"
echo "║                                                          ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  TÀI KHOẢN DEMO  (password: Demo@123456)                ║"
echo "║                                                          ║"
echo "║  admin@msb.com.vn      →  MSB Bank Admin                ║"
echo "║  marketing@msb.com.vn  →  Marketing Manager             ║"
echo "║  director@msb.com.vn   →  Marketing Director            ║"
echo "║  gameops@msb.com.vn    →  Game Ops                      ║"
echo "║  admin@mbbank.com.vn   →  MBB Bank Admin                ║"
echo "║  admin@tpbank.vn       →  TPB Bank Admin                ║"
echo "║  root@platform.io      →  Super Admin (slug: trống)     ║"
echo "║                                                          ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Adminer login:                                          ║"
echo "║    Server: postgres  User: bgp  Pass: bgp_dev_secret    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "${CYAN}Dừng hệ thống: ./stop.sh${NC}"
echo -e "${CYAN}Reset data:    ./reset-db.sh${NC}"
