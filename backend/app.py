import os, uuid, datetime as dt
from functools import wraps
import jwt
from dotenv import load_dotenv
from flask import Flask, request, jsonify, g
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

load_dotenv()
db = SQLAlchemy()
OPCIONES = ["No", "Ocasionalmente", "Frecuentemente", "Sistemáticamente"]
PERSPECTIVAS = {
 "Perspectiva económica": [
  "¿La empresa lleva un control de sus ingresos, gastos y ganancias?",
  "¿Cuenta con un presupuesto para enfrentar imprevistos económicos?",
  "¿Busca reducir costos sin afectar la calidad de sus productos o servicios?",
  "¿Tiene un plan para crecer y mantenerse en el mercado a largo plazo?"],
 "Perspectiva social": [
  "¿La empresa ofrece condiciones laborales justas y seguras?",
  "¿Respeta los derechos de sus trabajadores?",
  "¿Promueve la igualdad de oportunidades y evita la discriminación?",
  "¿Se preocupa por el bienestar de sus trabajadores y de la comunidad?"],
 "Perspectiva medioambiental": [
  "¿La empresa separa y recicla sus residuos?",
  "¿Busca reducir el consumo de agua y electricidad?",
  "¿Utiliza materiales o envases que generen menos contaminación?",
  "¿Tiene medidas para disminuir su impacto en el medioambiente?"],
 "Perspectiva de gobernanza": [
  "¿La empresa tiene reglas claras para tomar decisiones?",
  "¿Mantiene registros transparentes de sus ingresos y gastos?",
  "¿Cumple con las leyes laborales, tributarias y ambientales?",
  "¿Cuenta con medidas para prevenir la corrupción y los conflictos de interés?"],
}
TOTAL = sum(len(v) for v in PERSPECTIVAS.values())


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    company_name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text, default="")
    vision = db.Column(db.Text, default="")
    objectives = db.Column(db.Text, default="")


class RevokedToken(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    jti = db.Column(db.String(64), unique=True, nullable=False)


class Assessment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=dt.datetime.utcnow)
    answers = db.Column(db.JSON, nullable=False)
    scores = db.Column(db.JSON, nullable=False)
    total = db.Column(db.Float, nullable=False)

    def to_dict(self):
        return dict(id=self.id, created_at=self.created_at.isoformat(),
                    answers=self.answers, scores=self.scores, total=self.total)


CATALOGO = [
 ("eco1","💰",0,"Llevar un registro mensual de ingresos y gastos","Un control simple evita sorpresas y facilita decidir.","Meses con registro completo","ODS 8"),
 ("eco2","🛟",0,"Crear un fondo para imprevistos","Un colchón económico protege la continuidad de la empresa.","Monto ahorrado","ODS 8"),
 ("eco3","✂️",0,"Reducir costos sin perder calidad","Ahorrar sin afectar el producto mejora el margen.","Costo mensual por unidad","ODS 12"),
 ("soc1","🦺",1,"Formalizar condiciones laborales seguras","Un entorno seguro reduce riesgos y rotación.","Incidentes laborales por mes","ODS 8"),
 ("soc2","🤝",1,"Planificar una actividad con la comunidad","Fortalece el vínculo con el entorno de la empresa.","Actividades realizadas","ODS 11 · ODS 17"),
 ("soc3","⚖️",1,"Adoptar una política de igualdad de oportunidades","Previene la discriminación y mejora el clima laboral.","Política publicada (0/1)","ODS 5 · ODS 10"),
 ("amb1","♻️",2,"Separar y reciclar residuos","Reduce el volumen enviado a vertederos.","Kg reciclados por mes","ODS 12"),
 ("amb2","⚡",2,"Medir y reducir el consumo energético","Medir el consumo permite encontrar ahorros concretos.","kWh consumidos por mes","ODS 7 · ODS 12"),
 ("amb3","📦",2,"Cambiar a envases de menor impacto","Menos contaminación y mejor imagen de marca.","% de envases sostenibles","ODS 12"),
 ("gob1","📜",3,"Crear un código de conducta básico","Reglas claras previenen conflictos de interés y corrupción.","Código aprobado (0/1)","ODS 16"),
 ("gob2","🧾",3,"Transparentar registros de ingresos y gastos","Registros claros generan confianza interna y externa.","Informes compartidos por trimestre","ODS 16"),
 ("gob3","✅",3,"Revisar el cumplimiento de leyes laborales, tributarias y ambientales","Evita multas y riesgos legales.","Obligaciones al día (%)","ODS 16"),
]
CAT = {r[0]: r for r in CATALOGO}
ESTADOS = ["Pendiente", "En curso", "Completada"]


def cat_dict(r):
    return dict(id=r[0], icon=r[1], perspective=list(PERSPECTIVAS)[r[2]], title=r[3], why=r[4], indicator=r[5], ods=r[6])


class PlanItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    rec_id = db.Column(db.String(20), nullable=False)
    status = db.Column(db.String(20), default="Pendiente")
    owner = db.Column(db.String(80), default="")
    due = db.Column(db.String(10), default="")
    indicator = db.Column(db.String(160), default="")
    logs = db.relationship("Progress", backref="item", cascade="all, delete-orphan", order_by="Progress.id.desc()")

    def to_dict(self):
        return {**cat_dict(CAT[self.rec_id]), "id": self.id, "rec_id": self.rec_id, "status": self.status,
                "owner": self.owner, "due": self.due, "indicator": self.indicator, "logs": [l.to_dict() for l in self.logs]}


class Progress(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    item_id = db.Column(db.Integer, db.ForeignKey("plan_item.id"), nullable=False)
    note = db.Column(db.String(300), default="")
    value = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=dt.datetime.utcnow)

    def to_dict(self):
        return dict(id=self.id, note=self.note, value=self.value, created_at=self.created_at.isoformat())


def create_app(db_uri=None):
    app = Flask(__name__)
    url = (db_uri or os.getenv("DATABASE_URL") or "sqlite:///local.db").strip().strip("\"'")
    if "DATABASE_URL=" in url:
        url = url.split("DATABASE_URL=")[-1].strip().strip("\"'")
    if os.getenv("DB_HOST") and not db_uri:
        import hashlib
        from sqlalchemy.engine import URL
        pw = os.getenv("DB_PASSWORD", "").strip()
        print("DB_PASSWORD len=%d sha=%s" % (len(pw), hashlib.sha256(pw.encode()).hexdigest()[:6]), flush=True)
        url = URL.create("mysql+pymysql", username=os.getenv("DB_USER", "avnadmin"), password=pw,
                         host=os.getenv("DB_HOST").strip(), port=int(os.getenv("DB_PORT", "3306")),
                         database=os.getenv("DB_NAME", "defaultdb"),
                         query={"ssl_ca": "ca.pem"}).render_as_string(hide_password=False)
    url = url.replace("mysql://", "mysql+pymysql://", 1)
    from sqlalchemy.engine import make_url
    try:
        make_url(url)
    except Exception:
        raise SystemExit("DATABASE_URL invalida | tamanho=%d | inicio=%r" % (len(url), url[:14]))
    app.config.update(SQLALCHEMY_DATABASE_URI=url,
                      SECRET_KEY=os.getenv("SECRET_KEY", "dev-key-change-me"),
                      SQLALCHEMY_ENGINE_OPTIONS={"pool_pre_ping": True})
    CORS(app, origins=os.getenv("FRONTEND_URL", "*").split(","))
    db.init_app(app)
    with app.app_context():
        db.create_all()

    def auth(f):
        @wraps(f)
        def wrapper(*a, **k):
            h = request.headers.get("Authorization", "")
            if not h.startswith("Bearer "):
                return jsonify(error="No autenticado"), 401
            try:
                p = jwt.decode(h[7:], app.config["SECRET_KEY"], algorithms=["HS256"])
            except jwt.PyJWTError:
                return jsonify(error="Token inválido o expirado"), 401
            if RevokedToken.query.filter_by(jti=p["jti"]).first():
                return jsonify(error="Sesión cerrada"), 401
            g.user, g.jti = db.session.get(User, int(p["sub"])), p["jti"]
            if not g.user:
                return jsonify(error="Usuario no existe"), 401
            return f(*a, **k)
        return wrapper

    def perfil(u):
        return dict(email=u.email, company_name=u.company_name, description=u.description,
                    vision=u.vision, objectives=u.objectives)

    @app.get("/api/health")
    def health():
        return jsonify(ok=True)

    @app.get("/api/questions")
    def questions():
        return jsonify(options=OPCIONES, perspectives=PERSPECTIVAS)

    @app.post("/api/register")
    def register():
        d = request.get_json(silent=True) or {}
        email, pw, name = (d.get("email") or "").strip().lower(), d.get("password") or "", (d.get("company_name") or "").strip()
        if not name:
            return jsonify(error="Escribe el nombre de la empresa"), 400
        if "@" not in email or "." not in email.split("@")[-1]:
            return jsonify(error="Ingresa un email válido, por ejemplo nombre@empresa.com"), 400
        if len(pw) < 6:
            return jsonify(error="La contraseña debe tener al menos 6 caracteres"), 400
        if User.query.filter_by(email=email).first():
            return jsonify(error="Email ya registrado"), 409
        db.session.add(User(email=email, password_hash=generate_password_hash(pw), company_name=name))
        db.session.commit()
        return jsonify(ok=True), 201

    @app.post("/api/login")
    def login():
        d = request.get_json(silent=True) or {}
        u = User.query.filter_by(email=(d.get("email") or "").strip().lower()).first()
        if not u or not check_password_hash(u.password_hash, d.get("password") or ""):
            return jsonify(error="Credenciales incorrectas"), 401
        tok = jwt.encode({"sub": str(u.id), "jti": uuid.uuid4().hex,
                          "exp": dt.datetime.utcnow() + dt.timedelta(hours=8)},
                         app.config["SECRET_KEY"], algorithm="HS256")
        return jsonify(token=tok, profile=perfil(u))

    @app.post("/api/logout")
    @auth
    def logout():
        db.session.add(RevokedToken(jti=g.jti))
        db.session.commit()
        return jsonify(ok=True)

    @app.route("/api/profile", methods=["GET", "PUT"])
    @auth
    def profile():
        if request.method == "PUT":
            d = request.get_json(silent=True) or {}
            for f in ("company_name", "description", "vision", "objectives"):
                if f in d and (f != "company_name" or d[f].strip()):
                    setattr(g.user, f, str(d[f]).strip())
            db.session.commit()
        return jsonify(perfil(g.user))

    @app.route("/api/assessments", methods=["GET", "POST"])
    @auth
    def assessments():
        if request.method == "GET":
            rows = Assessment.query.filter_by(user_id=g.user.id).order_by(Assessment.id.desc()).all()
            return jsonify([a.to_dict() for a in rows])
        ans = (request.get_json(silent=True) or {}).get("answers")
        if not isinstance(ans, list) or len(ans) != TOTAL or any(type(x) is not int or not 0 <= x <= 3 for x in ans):
            return jsonify(error=f"Se requieren {TOTAL} respuestas (0-3)"), 400
        scores, i = {}, 0
        for name, qs in PERSPECTIVAS.items():
            scores[name] = round(sum(ans[i:i + len(qs)]) / (len(qs) * 3) * 100, 1)
            i += len(qs)
        a = Assessment(user_id=g.user.id, answers=ans, scores=scores, total=round(sum(ans) / (TOTAL * 3) * 100, 1))
        db.session.add(a)
        db.session.commit()
        return jsonify(a.to_dict()), 201

    @app.get("/api/assessments/<int:aid>")
    @auth
    def one(aid):
        a = db.session.get(Assessment, aid)
        if not a:
            return jsonify(error="No encontrado"), 404
        if a.user_id != g.user.id:
            return jsonify(error="Acceso denegado"), 403
        return jsonify(a.to_dict())


    def mine(oid):
        o = db.session.get(PlanItem, oid)
        if not o:
            return None, (jsonify(error="No encontrado"), 404)
        if o.user_id != g.user.id:
            return None, (jsonify(error="Acceso denegado"), 403)
        return o, None

    @app.get("/api/catalog")
    @auth
    def catalog():
        return jsonify([cat_dict(r) for r in CATALOGO])

    @app.get("/api/route")
    @auth
    def route():
        a = Assessment.query.filter_by(user_id=g.user.id).order_by(Assessment.id.desc()).first()
        if not a:
            return jsonify(has_diagnostic=False, items=[])
        inplan = {x.rec_id for x in PlanItem.query.filter_by(user_id=g.user.id)}
        items = []
        for r in CATALOGO:
            d = cat_dict(r)
            sc = a.scores[d["perspective"]]
            txt = "es una de tus principales brechas." if sc < 50 else "tiene oportunidad de mejora." if sc < 75 else "va bien: mantén y documenta esta práctica."
            items.append({**d, "score": sc, "priority": "Alta" if sc < 50 else "Media" if sc < 75 else "Baja",
                          "in_plan": r[0] in inplan, "reason": f"{d['perspective'].replace('Perspectiva ', '').capitalize()} ({sc}%): {txt}"})
        items.sort(key=lambda x: x["score"])
        return jsonify(has_diagnostic=True, items=items)

    @app.route("/api/plan", methods=["GET", "POST"])
    @auth
    def plan():
        if request.method == "POST":
            rid = (request.get_json(silent=True) or {}).get("rec_id")
            if rid not in CAT:
                return jsonify(error="Recomendación inválida"), 400
            if PlanItem.query.filter_by(user_id=g.user.id, rec_id=rid).first():
                return jsonify(error="Ya está en tu plan"), 409
            it = PlanItem(user_id=g.user.id, rec_id=rid, indicator=CAT[rid][5])
            db.session.add(it)
            db.session.commit()
            return jsonify(it.to_dict()), 201
        return jsonify([x.to_dict() for x in PlanItem.query.filter_by(user_id=g.user.id).order_by(PlanItem.id)])

    @app.route("/api/plan/<int:pid>", methods=["PUT", "DELETE"])
    @auth
    def plan_item(pid):
        it, err = mine(pid)
        if err:
            return err
        if request.method == "DELETE":
            db.session.delete(it)
            db.session.commit()
            return jsonify(ok=True)
        d = request.get_json(silent=True) or {}
        if "status" in d:
            if d["status"] not in ESTADOS:
                return jsonify(error="Estado inválido"), 400
            it.status = d["status"]
        for f, n in (("owner", 80), ("due", 10), ("indicator", 160)):
            if f in d:
                setattr(it, f, str(d[f]).strip()[:n])
        db.session.commit()
        return jsonify(it.to_dict())

    @app.post("/api/plan/<int:pid>/progress")
    @auth
    def progress(pid):
        it, err = mine(pid)
        if err:
            return err
        d = request.get_json(silent=True) or {}
        note = str(d.get("note") or "").strip()
        try:
            val = float(d["value"]) if d.get("value") not in (None, "") else None
        except (TypeError, ValueError):
            return jsonify(error="El valor debe ser numérico"), 400
        if not note and val is None:
            return jsonify(error="Escribe una nota o un valor"), 400
        db.session.add(Progress(item_id=it.id, note=note[:300], value=val))
        if it.status == "Pendiente":
            it.status = "En curso"
        db.session.commit()
        return jsonify(it.to_dict()), 201

    return app


app = create_app()
if __name__ == "__main__":
    app.run(debug=True, port=5000)
