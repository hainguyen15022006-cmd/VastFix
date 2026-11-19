# Image web Next.js cho bản chạy chung (compose.yaml) — Hoàng Anh.
# Chạy "next dev" vì phiên demo của Chúc chỉ bật khi NODE_ENV=development.
# Không chứa bí mật: mật khẩu demo được truyền lúc chạy từ .env của từng máy.
FROM node:24-bookworm-slim
RUN mkdir /app && chown node:node /app
USER node
WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci
COPY --chown=node:node . .
# prisma generate chỉ cần cấu hình đọc được URL, không kết nối DB.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm run db:generate
ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000
# Không đặt --hostname: Next dev nghe mọi interface và giữ host 127.0.0.1 của trình duyệt,
# điều kiện để phiên demo (chỉ cho loopback) hoạt động qua cổng Docker.
CMD ["node_modules/.bin/next", "dev", "--port", "3000"]
