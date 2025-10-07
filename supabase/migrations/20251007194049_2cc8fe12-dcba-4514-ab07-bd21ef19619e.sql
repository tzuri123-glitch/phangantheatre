-- מחיקת constraint הישן
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_status_check;

-- הוספת constraint חדש שמאפשר ערך ריק
ALTER TABLE public.attendance ADD CONSTRAINT attendance_status_check 
  CHECK (status IN ('נוכח', 'לא הגיע', 'לא באי', 'עזב', ''));