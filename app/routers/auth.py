from fastapi import APIRouter, Request, Form, Depends, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.security import verify_password, hash_password

router = APIRouter()
templates = Jinja2Templates(directory="templates")

@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse(request=request, name="login.html")

@router.post("/login")
async def process_login(
    request: Request, 
    username: str = Form(...), 
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    username = username.strip()
    user = db.query(User).filter(User.username == username).first()
    
    if not user or not verify_password(password, user.password_hash):
        return templates.TemplateResponse(
            request=request, 
            name="login.html", 
            context={"error": "Invalid username or password. Default password is your username."}
        )
    
    request.session["user_id"] = user.id
    request.session["username"] = user.username
    
    if user.first_login:
        return RedirectResponse(url="/change_password", status_code=303)
    
    return RedirectResponse(url="/", status_code=303)

@router.get("/change_password", response_class=HTMLResponse)
async def change_password_page(request: Request):
    if "user_id" not in request.session:
        return RedirectResponse(url="/login")
    return templates.TemplateResponse(request=request, name="change_password.html")

@router.post("/change_password")
async def process_change_password(
    request: Request, 
    new_password: str = Form(...),
    db: Session = Depends(get_db)
):
    user_id = request.session.get("user_id")
    if not user_id:
        return RedirectResponse(url="/login")
    
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.password_hash = hash_password(new_password)
        user.first_login = False
        db.commit()
    
    return RedirectResponse(url="/", status_code=303)

@router.get("/logout")
async def logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/login")
