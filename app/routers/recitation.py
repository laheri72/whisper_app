from fastapi import APIRouter, UploadFile, File, Form, Request, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import RecitationRecord
from app.ai_service import transcribe_audio_file, compare_recitation

router = APIRouter()

@router.post("/transcribe_and_compare")
async def transcribe_and_compare(
    request: Request,
    file: UploadFile = File(...),
    expected_text: str = Form(...),
    mode: str = Form("tasmee"),
    target_ref: str = Form("Practice"),
    db: Session = Depends(get_db)
):
    try:
        audio_bytes = await file.read()
        transcription = await transcribe_audio_file(audio_bytes, expected_text)
        
        result = compare_recitation(expected_text, transcription)
        
        user_id = request.session.get("user_id")
        if user_id:
            record = RecitationRecord(
                user_id=user_id,
                mode=mode,
                target_ref=target_ref,
                expected_text=expected_text,
                user_transcription=transcription,
                accuracy_score=result["accuracy_score"],
                correct_words=result["correct_words_count"],
                total_words=result["total_words"]
            )
            db.add(record)
            db.commit()
            
        return result
    except Exception as e:
        return {"error": f"Transcription processing failed: {str(e)}"}
