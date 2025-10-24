from pydantic import BaseModel
from typing import Optional, List

class ProfileInfo(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    company: Optional[str] = None

class ExperienceItem(BaseModel):
    title: Optional[str] = None
    company: Optional[str] = None
    dateRange: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None

class EducationItem(BaseModel):
    school: Optional[str] = None
    degree: Optional[str] = None
    fieldOfStudy: Optional[str] = None
    dateRange: Optional[str] = None

class AwardItem(BaseModel):
    name: Optional[str] = None
    issuer: Optional[str] = None
    date: Optional[str] = None
    description: Optional[str] = None

class ExtendedProfile(BaseModel):
    about: Optional[str] = None
    experiences: Optional[List[ExperienceItem]] = None
    education: Optional[List[EducationItem]] = None
    awards: Optional[List[AwardItem]] = None
    recentPosts: Optional[List[dict]] = None

class GenerateRequest(BaseModel):
    intent: Optional[str] = None
    profileInfo: ProfileInfo
    extendedProfile: ExtendedProfile

class GenerateResponse(BaseModel):
    message: str
