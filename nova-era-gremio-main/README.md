# Homepage Institucional — Grêmio Estudantil Nova Era

Site institucional 100% estático desenvolvido em **HTML5, CSS3 e JavaScript puro** para a chapa **Nova Era**, sem dependência de bancos de dados, APIs externas, servidores backend ou serviços pagos.

## 1. Como testar localmente

Como o site carrega dados de arquivos `.json` via `fetch()`, utilize qualquer servidor estático simples:
- **VS Code:** instale a extensão **Live Server** e clique em **Go Live**.
- **Python:** na pasta raiz do projeto, execute `python3 -m http.server 8080` e acesse `http://localhost:8080`.

## 2. Como substituir o logotipo oficial

1. Salve o arquivo oficial em `assets/logo/` (ex.: `logo-oficial.png`).
2. Edite `data/config.json` e atualize `"logoPath": "./assets/logo/logo-oficial.png"`.
3. Atualize o `<link rel="icon">` em `index.html` e `admin.html`.

## 3. Como adicionar fotografias e integrantes da equipe

Coloque as fotos em `assets/membros/` e edite `data/equipe.json`.

## 4. Como cadastrar projetos e notícias

Edite `data/projetos.json` e `data/noticias.json`.

## 5. Como administrar comentários

Acesse `admin.html` (senha inicial configurável em `data/config.json`: `novaera2026`), responda/modere os comentários e clique em **Exportar comentarios.json** para substituir `data/comentarios.json` no repositório público.