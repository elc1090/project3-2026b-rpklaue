import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import pytest
from app import create_app

@pytest.fixture
def c():
    return create_app("sqlite://").test_client()

def reg(c, email):
    c.post("/api/register", json={"email": email, "password": "123456", "company_name": "X"})
    t = c.post("/api/login", json={"email": email, "password": "123456"}).json["token"]
    return {"Authorization": f"Bearer {t}"}

def test_sin_token_negado(c):
    assert c.get("/api/profile").status_code == 401
    assert c.post("/api/assessments", json={}).status_code == 401

def test_login_incorrecto(c):
    reg(c, "a@a.com")
    assert c.post("/api/login", json={"email": "a@a.com", "password": "mal"}).status_code == 401

def test_flujo_permitido_y_aislamiento(c):
    h1, h2 = reg(c, "a@a.com"), reg(c, "b@b.com")
    assert c.put("/api/profile", json={"vision": "v"}, headers=h1).json["vision"] == "v"
    r = c.post("/api/assessments", json={"answers": [3] * 16}, headers=h1)
    assert r.status_code == 201 and r.json["total"] == 100
    assert c.get(f"/api/assessments/{r.json['id']}", headers=h1).status_code == 200
    assert c.get(f"/api/assessments/{r.json['id']}", headers=h2).status_code == 403
    assert c.get("/api/assessments", headers=h2).json == []

def test_logout_invalida_token(c):
    h = reg(c, "a@a.com")
    assert c.post("/api/logout", headers=h).status_code == 200
    assert c.get("/api/profile", headers=h).status_code == 401

def test_plan_acceso_y_ruta(c):
    h1, h2 = reg(c, "a@a.com"), reg(c, "b@b.com")
    assert c.get("/api/plan").status_code == 401
    r = c.post("/api/plan", json={"rec_id": "amb2"}, headers=h1)
    assert r.status_code == 201
    pid = r.json["id"]
    assert c.post("/api/plan", json={"rec_id": "amb2"}, headers=h1).status_code == 409
    assert c.put(f"/api/plan/{pid}", json={"status": "En curso"}, headers=h2).status_code == 403
    assert c.delete(f"/api/plan/{pid}", headers=h2).status_code == 403
    assert c.post(f"/api/plan/{pid}/progress", json={"value": 5}, headers=h1).status_code == 201
    assert c.get("/api/plan", headers=h2).json == []
    c.post("/api/assessments", json={"answers": [0] * 16}, headers=h1)
    assert c.get("/api/route", headers=h1).json["items"][0]["priority"] == "Alta"
