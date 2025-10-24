import os
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import timedelta
from dotenv import load_dotenv

from database import get_db, User
from auth import authenticate_user, create_access_token, get_current_user, get_password_hash
from google_auth import google_oauth, google_auth_callback
from models.profile import GenerateRequest, GenerateResponse
from services.openrouter import generate_message

load_dotenv()

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {"ok": True}

@app.post("/register")
async def register(username: str, email: str, password: str, db: Session = Depends(get_db)):
    # Check if user already exists
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=400, detail="Username already registered")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new user
    hashed_password = get_password_hash(password)
    user = User(username=username, email=email, hashed_password=hashed_password)
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return {"message": "User created successfully"}

@app.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=30)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/login/google")
async def google_login():
    return {"message": "Google OAuth not implemented yet"}

@app.get("/auth/google/callback")
async def google_callback(token: str = Depends(google_auth_callback)):
    return token

@app.get("/me")
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@app.post("/api/generate", response_model=GenerateResponse)
async def generate(req: GenerateRequest):
    message = await generate_message(
        req.intent,
        req.profileInfo.dict(),
        req.extendedProfile.dict(),
    )
    return GenerateResponse(message=message)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
