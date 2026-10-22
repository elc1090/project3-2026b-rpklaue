

Plataforma web de **autodiagnóstico de sostenibilidad para PyMEs**. A empresa se cadastra, descreve quem é, responde um questionário nas perspectivas econômica, social, ambiental e de governança, recebe uma **rota sustentável** personalizada, monta um **plano de ação** e faz o **seguimento** da evolução.


## Tecnologias

| Camada | Tecnologia | Hospedagem |
|---|---|---|
| Frontend | HTML5, CSS3, JavaScript (sem frameworks) | Netlify |
| Backend | Python, Flask, Flask-SQLAlchemy, PyJWT | Render |
| Banco de dados | MySQL (PyMySQL + SQLAlchemy); SQLite no desenvolvimento local | MySQL em nuvem |

```
Navegador ──► Netlify (arquivos estáticos)
     └── fetch + JSON ──► Render (Flask + gunicorn) ──► MySQL
```

## Estrutura

```
backend/   app.py (modelos, regras e rotas) · requirements.txt · tests/test_api.py · .env.example
frontend/  index.html · style.css · config.js (URL da API) · app.js (sessão, questionário, resultados) · plan.js (menu, rota, plano, seguimento)
```

## Funcionamento pro usuário

1. **Cadastro e login** da empresa.
2. **Mi empresa**: descrição, visão e objetivos gerais.
3. **Diagnóstico**: 16 perguntas (4 por perspectiva) com respostas A–D, de "No" a "Sistemáticamente". O servidor converte as respostas em pontuação (0–100 %) por perspectiva e total, e classifica em Inicial, En desarrollo, Avanzado ou Consolidado.
4. **Resultado**: gráfico radar, nível, recomendações e histórico.
5. **Ruta sostenible**: catálogo de 12 recomendações ordenado pelas maiores brechas do último diagnóstico (recalculado a cada consulta).
6. **Mi plan**: cada recomendação vira uma ação com estado, responsável, prazo e indicador.
7. **Seguimiento**: registro de avanços e comparação entre diagnósticos.

## Autenticação e autorização

- **Senhas:** nunca são armazenadas em texto; guarda-se apenas o hash com sal (`werkzeug.security`).
- **Login:** valida e-mail e senha e devolve um **JWT** (HS256, validade de 8 h) assinado com `SECRET_KEY`, contendo o id do usuário e um identificador único (`jti`).
- **Sessão:** o frontend guarda o token no `localStorage` e o envia em `Authorization: Bearer <token>`.
- **Logout:** o `jti` é gravado em `revoked_token`, invalidando o token no servidor.
- **Proteção das rotas:** o decorador `@auth` verifica, em ordem, presença do token, assinatura e validade, revogação e existência do usuário (falha = `401`).
- **Autorização:** cada empresa só acessa os próprios dados. Listagens filtram por `user_id`; acessos por id comparam o dono do registro (`403` se for de outro usuário, `404` se não existir).
- **CORS:** a API só aceita chamadas do endereço definido em `FRONTEND_URL`.

## API

Públicas: `GET /api/health`, `GET /api/questions`, `POST /api/register`, `POST /api/login`.
Protegidas (exigem token): `POST /api/logout`, `GET|PUT /api/profile`, `GET|POST /api/assessments`, `GET /api/assessments/<id>`, `GET /api/catalog`, `GET /api/route`, `GET|POST /api/plan`, `PUT|DELETE /api/plan/<id>`, `POST /api/plan/<id>/progress`.

## Executar localmente

```bash
cd backend
python -m venv venv && venv\Scripts\activate      # Mac/Linux: source venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env                               # Windows: copy .env.example .env
python app.py                                      # http://127.0.0.1:5000
```
No `.env` use `DATABASE_URL=sqlite:///local.db` para testar sem MySQL. Abra `frontend/index.html` com a extensão Live Server (porta 5500).

**Testes:** `python -m pytest` (na pasta `backend`) cobre acesso sem token, login incorreto, isolamento entre empresas, logout e plano de ação.

## Deploy

- **Render** (Root Directory `backend`): build `pip install -r requirements.txt`, start `gunicorn app:app`. Variáveis: `SECRET_KEY`, `DATABASE_URL` (`mysql+pymysql://usuario:senha@host:porta/banco`) e `FRONTEND_URL` (URL do Netlify, sem barra final).
- **Netlify:** build command vazio, publish directory `frontend`. Antes, ajuste `frontend/config.js` com a URL do Render.

