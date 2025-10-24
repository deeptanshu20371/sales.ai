import React, { useState } from 'react';
import { generateApi } from '../lib/api';
import { SparklesIcon, UserIcon, BuildingOfficeIcon, AcademicCapIcon } from '@heroicons/react/24/outline';

const MessageGenerator: React.FC = () => {
  const [intent, setIntent] = useState('');
  const [profileInfo, setProfileInfo] = useState({
    name: '',
    title: '',
    company: '',
  });
  const [extendedProfile, setExtendedProfile] = useState({
    about: '',
    experiences: [{ title: '', company: '', dateRange: '', location: '', description: '' }],
    education: [{ school: '', degree: '', fieldOfStudy: '', dateRange: '' }],
    awards: [{ name: '', issuer: '', date: '', description: '' }],
    recentPosts: [],
  });
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerateMessage = async () => {
    if (!profileInfo.name.trim()) {
      setError('Please enter at least a name for the profile');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await generateApi.generateMessage({
        intent: intent || undefined,
        profileInfo,
        extendedProfile,
      });
      setGeneratedMessage(response.message);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to generate message');
    } finally {
      setLoading(false);
    }
  };

  const addExperience = () => {
    setExtendedProfile(prev => ({
      ...prev,
      experiences: [...prev.experiences, { title: '', company: '', dateRange: '', location: '', description: '' }]
    }));
  };

  const removeExperience = (index: number) => {
    setExtendedProfile(prev => ({
      ...prev,
      experiences: prev.experiences.filter((_, i) => i !== index)
    }));
  };

  const updateExperience = (index: number, field: string, value: string) => {
    setExtendedProfile(prev => ({
      ...prev,
      experiences: prev.experiences.map((exp, i) => 
        i === index ? { ...exp, [field]: value } : exp
      )
    }));
  };

  const addEducation = () => {
    setExtendedProfile(prev => ({
      ...prev,
      education: [...prev.education, { school: '', degree: '', fieldOfStudy: '', dateRange: '' }]
    }));
  };

  const removeEducation = (index: number) => {
    setExtendedProfile(prev => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== index)
    }));
  };

  const updateEducation = (index: number, field: string, value: string) => {
    setExtendedProfile(prev => ({
      ...prev,
      education: prev.education.map((edu, i) => 
        i === index ? { ...edu, [field]: value } : edu
      )
    }));
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedMessage);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Message Generator</h1>
        <p className="mt-1 text-sm text-gray-500">
          Generate personalized LinkedIn outreach messages using AI
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <div className="space-y-6">
          {/* Intent */}
          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Message Intent</h3>
            <textarea
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              placeholder="e.g., intro for partnership, ask for call, follow up on shared connection"
              className="input-field h-20 resize-none"
            />
          </div>

          {/* Profile Info */}
          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <UserIcon className="h-5 w-5 mr-2" />
              Profile Information
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={profileInfo.name}
                  onChange={(e) => setProfileInfo(prev => ({ ...prev, name: e.target.value }))}
                  className="input-field"
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={profileInfo.title}
                  onChange={(e) => setProfileInfo(prev => ({ ...prev, title: e.target.value }))}
                  className="input-field"
                  placeholder="Job title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company
                </label>
                <input
                  type="text"
                  value={profileInfo.company}
                  onChange={(e) => setProfileInfo(prev => ({ ...prev, company: e.target.value }))}
                  className="input-field"
                  placeholder="Company name"
                />
              </div>
            </div>
          </div>

          {/* About */}
          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 mb-4">About</h3>
            <textarea
              value={extendedProfile.about}
              onChange={(e) => setExtendedProfile(prev => ({ ...prev, about: e.target.value }))}
              placeholder="Brief description about the person"
              className="input-field h-24 resize-none"
            />
          </div>

          {/* Experience */}
          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <BuildingOfficeIcon className="h-5 w-5 mr-2" />
              Experience
            </h3>
            <div className="space-y-4">
              {extendedProfile.experiences.map((exp, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-medium text-gray-900">Experience {index + 1}</h4>
                    {extendedProfile.experiences.length > 1 && (
                      <button
                        onClick={() => removeExperience(index)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={exp.title}
                      onChange={(e) => updateExperience(index, 'title', e.target.value)}
                      placeholder="Job title"
                      className="input-field"
                    />
                    <input
                      type="text"
                      value={exp.company}
                      onChange={(e) => updateExperience(index, 'company', e.target.value)}
                      placeholder="Company"
                      className="input-field"
                    />
                    <input
                      type="text"
                      value={exp.dateRange}
                      onChange={(e) => updateExperience(index, 'dateRange', e.target.value)}
                      placeholder="Date range"
                      className="input-field"
                    />
                    <input
                      type="text"
                      value={exp.location}
                      onChange={(e) => updateExperience(index, 'location', e.target.value)}
                      placeholder="Location"
                      className="input-field"
                    />
                  </div>
                  <textarea
                    value={exp.description}
                    onChange={(e) => updateExperience(index, 'description', e.target.value)}
                    placeholder="Description"
                    className="input-field mt-3 h-16 resize-none"
                  />
                </div>
              ))}
              <button
                onClick={addExperience}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                + Add Experience
              </button>
            </div>
          </div>

          {/* Education */}
          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <AcademicCapIcon className="h-5 w-5 mr-2" />
              Education
            </h3>
            <div className="space-y-4">
              {extendedProfile.education.map((edu, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-medium text-gray-900">Education {index + 1}</h4>
                    {extendedProfile.education.length > 1 && (
                      <button
                        onClick={() => removeEducation(index)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={edu.school}
                      onChange={(e) => updateEducation(index, 'school', e.target.value)}
                      placeholder="School"
                      className="input-field"
                    />
                    <input
                      type="text"
                      value={edu.degree}
                      onChange={(e) => updateEducation(index, 'degree', e.target.value)}
                      placeholder="Degree"
                      className="input-field"
                    />
                    <input
                      type="text"
                      value={edu.fieldOfStudy}
                      onChange={(e) => updateEducation(index, 'fieldOfStudy', e.target.value)}
                      placeholder="Field of study"
                      className="input-field"
                    />
                    <input
                      type="text"
                      value={edu.dateRange}
                      onChange={(e) => updateEducation(index, 'dateRange', e.target.value)}
                      placeholder="Date range"
                      className="input-field"
                    />
                  </div>
                </div>
              ))}
              <button
                onClick={addEducation}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                + Add Education
              </button>
            </div>
          </div>
        </div>

        {/* Generated Message */}
        <div className="space-y-6">
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <SparklesIcon className="h-5 w-5 mr-2" />
                Generated Message
              </h3>
              {generatedMessage && (
                <button
                  onClick={copyToClipboard}
                  className="btn-secondary text-sm"
                >
                  Copy
                </button>
              )}
            </div>
            
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md mb-4">
                {error}
              </div>
            )}
            
            <div className="mb-4">
              <button
                onClick={handleGenerateMessage}
                disabled={loading || !profileInfo.name.trim()}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Generating...
                  </div>
                ) : (
                  'Generate Message'
                )}
              </button>
            </div>
            
            {generatedMessage && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-gray-900 whitespace-pre-wrap">{generatedMessage}</p>
              </div>
            )}
            
            {!generatedMessage && !loading && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                <SparklesIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Fill in the profile information and click "Generate Message" to create a personalized outreach message.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageGenerator;
