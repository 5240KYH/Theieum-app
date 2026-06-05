# Oracle Always Free 스테이징 배포 런북

작성일: 2026-06-05

이 문서는 더이음 전자결재 앱을 Oracle Cloud Always Free VM에 올려 30명 안팎의 외부 체험자가 며칠간 사용할 수 있게 만드는 절차다. 정식 운영 배포가 아니라 사전 체험 환경이며, 실제 개인정보와 실제 영수증을 넣지 않는다.

참고 공식 문서:

- Oracle Always Free 리소스: <https://docs.oracle.com/iaas/Content/FreeTier/resourceref.htm>
- Oracle Compute instance 생성: <https://docs.oracle.com/iaas/Content/Compute/Tasks/launchinginstance.htm>
- Docker Engine on Ubuntu: <https://docs.docker.com/engine/install/ubuntu/>
- Caddy reverse proxy: <https://caddyserver.com/docs/quick-starts/reverse-proxy>
- Caddy automatic HTTPS: <https://caddyserver.com/docs/automatic-https>

## 1. 권장 구성

- VM: Oracle Cloud Ampere A1, Ubuntu ARM64
- 크기: 2 OCPU / 12GB RAM부터 시작
- Docker: backend, frontend, postgres를 `docker-compose.staging.yml`로 실행
- HTTPS: VM host의 Caddy가 `80/443`을 받고 `127.0.0.1:3000`으로 reverse proxy
- 외부 공개 포트: `80`, `443`, 운영자 SSH용 `22`
- 외부 비공개 포트: `3000`, `8080`, `5432`

30명 규모의 체험은 앱 사용 빈도가 아주 높지 않다면 2 OCPU / 12GB RAM으로 시작해도 충분하다. 부족하면 Always Free 한도 안에서 4 OCPU / 24GB RAM까지 키우는 방향으로 조정한다.

## 2. 사전 준비

준비물:

- Oracle Cloud 계정
- SSH 공개키
- 도메인 또는 임시 서브도메인
- GitHub 저장소 접근 방식
  - public repo 유지: secret과 실제 개인정보가 없을 때만 허용
  - private repo 전환: 외부 공개가 부담되면 권장
  - private repo 접근: read-only deploy key 권장

GitHub 공개 저장소를 유지해도 되는 조건:

- `.env.staging` 같은 secret 파일이 git에 없다.
- 실제 개인정보, 실제 영수증, 운영 DB dump가 없다.
- 테스트 계정 비밀번호가 운영/개인 서비스와 재사용되지 않는다.
- 공개되어도 무방한 개발/체험 문서만 포함한다.

위 조건 중 하나라도 애매하면 GitHub 저장소를 private로 바꾼 뒤 배포한다.

## 3. Oracle VM 생성

Oracle 콘솔에서 Compute instance를 만든다.

권장 값:

- Image: Ubuntu 24.04 또는 22.04, ARM64
- Shape: VM.Standard.A1.Flex
- OCPU: 2
- Memory: 12GB
- Public IPv4: enabled
- SSH key: 운영자 공개키 등록

VCN 또는 Network Security Group에서 ingress를 연다.

| Port | Source | Purpose |
| --- | --- | --- |
| 22 | 운영자 IP 또는 제한된 IP | SSH |
| 80 | `0.0.0.0/0` | HTTP, Let's Encrypt challenge and redirect |
| 443 | `0.0.0.0/0` | HTTPS |

열지 않는다.

| Port | Reason |
| --- | --- |
| 3000 | Caddy 내부 proxy만 사용 |
| 8080 | backend 직접 공개 금지 |
| 5432 | PostgreSQL 직접 공개 금지 |

Ubuntu 방화벽을 쓰는 경우:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

## 4. Docker 설치

VM에 SSH 접속한다.

```bash
ssh ubuntu@<ORACLE_PUBLIC_IP>
```

Docker 공식 Ubuntu 저장소를 사용한다.

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
```

다시 로그인한 뒤 확인한다.

```bash
docker version
docker compose version
```

## 5. 소스 배포

public repo라면:

```bash
git clone git@github.com:5240KYH/Theieum-app.git theieum
cd theieum
```

private repo라면 read-only deploy key를 권장한다.

```bash
ssh-keygen -t ed25519 -C "theieum-staging-deploy" -f ~/.ssh/theieum-staging-deploy
cat ~/.ssh/theieum-staging-deploy.pub
```

GitHub repository settings에서 deploy key로 등록한 뒤:

```bash
cat >> ~/.ssh/config <<'EOF'
Host github.com-theieum-staging
  HostName github.com
  User git
  IdentityFile ~/.ssh/theieum-staging-deploy
  IdentitiesOnly yes
EOF

git clone git@github.com-theieum-staging:5240KYH/Theieum-app.git theieum
cd theieum
```

## 6. 스테이징 환경변수

```bash
cp .env.staging.example .env.staging
```

`.env.staging`를 편집한다.

```dotenv
SPRING_PROFILES_ACTIVE=local
DB_NAME=approval_staging
DB_USERNAME=approval_staging
DB_PASSWORD=<긴 난수 DB 비밀번호>
JWT_SECRET=<긴 난수 JWT secret>
FRONTEND_HTTP_PORT=127.0.0.1:3000
STAGING_PUBLIC_URL=https://<staging-domain>
```

확인한다.

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml config
```

렌더링 결과에서 `frontend`만 `127.0.0.1:3000->80`으로 열려야 한다. `backend`와 `postgres`에는 `ports:`가 없어야 한다.

## 7. 앱 기동

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml up --build -d postgres backend frontend
docker compose --env-file .env.staging -f docker-compose.staging.yml ps
```

VM 내부에서 확인한다.

```bash
scripts/staging-smoke.sh http://127.0.0.1:3000
```

## 8. Caddy HTTPS 설정

Caddy를 설치한다.

```bash
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update
sudo apt-get install -y caddy
```

DNS에서 `<staging-domain>`의 A record를 Oracle VM public IP로 연결한다.

Caddyfile을 작성한다.

```bash
sudo tee /etc/caddy/Caddyfile > /dev/null <<'EOF'
<staging-domain> {
  encode gzip
  reverse_proxy 127.0.0.1:3000
}
EOF

sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

외부에서 검증한다.

```bash
scripts/staging-smoke.sh https://<staging-domain>
cd e2e
E2E_BASE_URL=https://<staging-domain> npm run test -- mobile-pwa-staging.spec.ts
```

## 9. 체험 시작 전 보안 점검

- GitHub public 유지 여부를 최종 결정한다.
- public 유지 시 `.env.staging`, DB dump, 실제 첨부파일, 실제 개인정보가 repo에 없는지 확인한다.
- private 전환 시 VM에는 read-only deploy key만 둔다.
- Oracle Security List/NSG에서 `80`, `443`, 필요한 경우 제한된 `22`만 열려 있는지 확인한다.
- `3000`, `8080`, `5432`가 외부에서 닫혀 있는지 확인한다.
- 체험자는 개인별 계정으로 배정한다.
- 공유 확인용 계정은 비밀번호 변경 금지를 안내한다.
- 매니저 체험 계정은 `MANAGER` 역할을 확인한다.

외부 포트 확인 예:

```bash
nc -vz <staging-domain> 443
nc -vz <staging-domain> 80
nc -vz <staging-domain> 3000
nc -vz <staging-domain> 8080
nc -vz <staging-domain> 5432
```

`443`과 `80`만 열려야 한다. `3000`, `8080`, `5432`는 실패해야 한다.

## 10. 운영 중 업데이트

```bash
cd ~/theieum
git fetch origin
git checkout main
git pull --ff-only origin main
docker compose --env-file .env.staging -f docker-compose.staging.yml up --build -d backend frontend
scripts/staging-smoke.sh https://<staging-domain>
```

DB migration이 있는 변경은 업데이트 전 DB와 첨부 volume 보존 정책을 먼저 정한다.

## 11. 종료

보존:

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml stop
```

완전 삭제:

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml down -v
```

VM 자체를 삭제하기 전 필요한 피드백, 로그, 첨부파일 보존 여부를 확정한다.
