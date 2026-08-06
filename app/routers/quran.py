from fastapi import APIRouter, Request, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models import User, RecitationRecord

router = APIRouter()

@router.get("/profile_data")
async def get_profile(request: Request, db: Session = Depends(get_db)):
    user_id = request.session.get("user_id")
    username = request.session.get("username")
    if not user_id:
        return {"error": "Not logged in"}
    
    # Calculate stats from Database RecitationRecords
    tasmee_records = db.query(RecitationRecord).filter(
        RecitationRecord.user_id == user_id, 
        RecitationRecord.mode == "tasmee"
    ).all()

    ikhtebaar_records = db.query(RecitationRecord).filter(
        RecitationRecord.user_id == user_id, 
        RecitationRecord.mode == "ikhtebaar"
    ).all()

    avg_tasmee = round(sum(r.accuracy_score for r in tasmee_records) / len(tasmee_records), 1) if tasmee_records else 0.0
    avg_ikhtebaar = round(sum(r.accuracy_score for r in ikhtebaar_records) / len(ikhtebaar_records), 1) if ikhtebaar_records else 0.0

    return {
        "username": username,
        "stats": {
            "tasmee_score": avg_tasmee,
            "ikhtebaar_score": avg_ikhtebaar,
            "total_recitations": len(tasmee_records) + len(ikhtebaar_records)
        }
    }
