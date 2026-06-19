/*
Filename: index.jsx
Author: Wyatt McCurdy, GitHub Copilot
Date: November 24, 2025

Person detail page that displays comprehensive information about a researcher
including their bio, expertise, department, institution, and projects.
*/

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Button, IconButton } from "@mui/material";
import { useTheme } from "@mui/material";
import {
  Mail,
  Phone,
  MapPin,
  Building2,
  BookOpen,
  ArrowLeft,
  User,
  Briefcase,
  Plus,
  Edit,
  Trash2
} from "lucide-react";
import axios from "axios";
import { tokens } from "../../theme";
import Header from "../../components/Header";
import AddProjectModal from "../../components/AddProjectModal";
import EditProjectModal from "../../components/EditProjectModal";
import EditProfileModal from "../../components/EditProfileModal";
import DeleteAccountModal from "../../components/DeleteAccountModal";

const Person = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);

  const [person, setPerson] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);

  useEffect(() => {
    const fetchPersonData = async () => {
      try {
        setLoading(true);
        
        // Check if this is the logged-in user's profile
        const storedPersonId = localStorage.getItem('person_id');
        const accessToken = localStorage.getItem('access_token');
        
        // Debug logging
        console.log('Profile Check:', {
          storedPersonId,
          urlId: id,
          hasToken: !!accessToken,
          match: storedPersonId === String(id)
        });
        
        // User must be logged in (have token) and the person_id must match
        const isOwn = !!accessToken && storedPersonId && storedPersonId === String(id);
        setIsOwnProfile(isOwn);
        console.log('isOwnProfile set to:', isOwn);
        
        // Fetch person details
        const personResponse = await axios.get(`http://127.0.0.1:5001/person/${id}`);
        setPerson(personResponse.data.data);

        // Fetch person's projects
        const projectsResponse = await axios.get(`http://127.0.0.1:5001/person/${id}/projects`);
        setProjects(projectsResponse.data.data || []);

        setLoading(false);
      } catch (err) {
        console.error(err);
        setError(err.message);
        setLoading(false);
      }
    };

    if (id) {
      fetchPersonData();
    }
  }, [id]);

  const handleProjectAdded = async () => {
    try {
      const projectsResponse = await axios.get(`http://127.0.0.1:5001/person/${id}/projects`);
      setProjects(projectsResponse.data.data || []);
    } catch (err) {
      console.error('Failed to refresh projects', err);
    }
  };

  const handleEditProject = (project) => {
    setSelectedProject(project);
    setShowEditProjectModal(true);
  };

  const handleProjectUpdated = async () => {
    await handleProjectAdded();
  };

  const handleProjectDeleted = async () => {
    await handleProjectAdded();
  };

  const handleMessageProfile = () => {
    navigate(`/messages?recipient=${id}`);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress sx={{ color: colors.greenAccent[500] }} />
      </Box>
    );
  }

  if (error || !person) {
    return (
      <Box m="20px">
        <Header title="Error" subtitle="Failed to load person data" />
        <Box
          backgroundColor={colors.primary[400]}
          borderRadius="12px"
          padding="24px"
          textAlign="center"
        >
          <p style={{ color: colors.grey[300] }}>
            {error || "Person not found"}
          </p>
          <button
            onClick={() => navigate('/search')}
            style={{
              marginTop: "16px",
              padding: "10px 20px",
              backgroundColor: colors.greenAccent[600],
              color: colors.grey[900],
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600"
            }}
          >
            Back to Search
          </button>
        </Box>
      </Box>
    );
  }

  const { person: personData, department, institution } = person;

  return (
    <Box m="20px">
      {/* Back Button */}
      <button
        onClick={() => navigate('/search')}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "16px",
          padding: "8px 16px",
          backgroundColor: colors.primary[400],
          color: colors.grey[100],
          border: `1px solid ${colors.primary[300]}`,
          borderRadius: "8px",
          cursor: "pointer",
          fontSize: "14px",
          transition: "all 0.2s"
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = colors.primary[300];
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = colors.primary[400];
        }}
      >
        <ArrowLeft style={{ width: "16px", height: "16px" }} />
        Back to Search
      </button>

      {/* Header with Edit Button */}
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Header
          title={personData.person_name}
          subtitle={personData.main_field || "Researcher"}
        />
        {isOwnProfile && (
          <Button
            variant="contained"
            startIcon={<Edit />}
            onClick={() => setShowEditProfileModal(true)}
            sx={{
              backgroundColor: colors.blueAccent[600],
              color: colors.grey[100],
              fontWeight: 600,
              px: 3,
              py: 1.5,
              borderRadius: '8px',
              '&:hover': {
                backgroundColor: colors.blueAccent[700]
              }
            }}
          >
            Edit Profile
          </Button>
        )}
        {!isOwnProfile && personData.person_email && (
          <Button
            variant="contained"
            startIcon={<Mail />}
            onClick={handleMessageProfile}
            sx={{
              backgroundColor: colors.greenAccent[600],
              color: colors.grey[900],
              fontWeight: 600,
              px: 3,
              py: 1.5,
              borderRadius: '8px',
              ml: 2,
              '&:hover': {
                backgroundColor: colors.greenAccent[700]
              }
            }}
          >
            Message
          </Button>
        )}
      </Box>

      {/* Main Content Grid */}
      <Box
        display="grid"
        gridTemplateColumns="repeat(12, 1fr)"
        gap="20px"
        mt="20px"
      >
        {/* Left Column - Person Info */}
        <Box
          gridColumn="span 4"
          backgroundColor={colors.primary[400]}
          borderRadius="12px"
          border={`1px solid ${colors.primary[300]}`}
          padding="24px"
        >
          {/* Profile Icon */}
          <Box
            display="flex"
            justifyContent="center"
            marginBottom="24px"
          >
            <Box
              width="120px"
              height="120px"
              borderRadius="50%"
              backgroundColor={colors.primary[300]}
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <User
                style={{
                  width: "64px",
                  height: "64px",
                  color: colors.grey[300]
                }}
              />
            </Box>
          </Box>

          {/* Contact Information */}
          <Box marginBottom="24px">
            <h3
              style={{
                color: colors.grey[100],
                fontSize: "14px",
                fontWeight: "600",
                marginBottom: "16px",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}
            >
              Contact Information
            </h3>

            {personData.person_email && (
              <a
                href={`mailto:${personData.person_email}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px",
                  marginBottom: "8px",
                  backgroundColor: colors.primary[500],
                  borderRadius: "8px",
                  color: colors.grey[100],
                  textDecoration: "none",
                  transition: "background-color 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.primary[300];
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.primary[500];
                }}
              >
                <Mail style={{ width: "16px", height: "16px", color: colors.greenAccent[500] }} />
                <span style={{ fontSize: "14px", wordBreak: "break-all" }}>
                  {personData.person_email}
                </span>
              </a>
            )}

            {personData.person_phone && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px",
                  backgroundColor: colors.primary[500],
                  borderRadius: "8px",
                  color: colors.grey[100]
                }}
              >
                <Phone style={{ width: "16px", height: "16px", color: colors.greenAccent[500] }} />
                <span style={{ fontSize: "14px" }}>
                  {personData.person_phone}
                </span>
              </div>
            )}
          </Box>

          {/* Department */}
          {department?.department_name && (
            <Box marginBottom="24px">
              <h3
                style={{
                  color: colors.grey[100],
                  fontSize: "14px",
                  fontWeight: "600",
                  marginBottom: "16px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}
              >
                Department
              </h3>
              <div
                onClick={() => navigate(`/department/${department.department_id}`)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px",
                  backgroundColor: colors.primary[500],
                  borderRadius: "8px",
                  cursor: "pointer",
                  transition: "background-color 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.primary[300];
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.primary[500];
                }}
              >
                <Briefcase style={{ width: "16px", height: "16px", color: colors.blueAccent[500] }} />
                <span style={{ fontSize: "14px", color: colors.grey[100] }}>
                  {department.department_name}
                </span>
              </div>
            </Box>
          )}

          {/* Institution */}
          {institution?.institution_name && (
            <Box>
              <h3
                style={{
                  color: colors.grey[100],
                  fontSize: "14px",
                  fontWeight: "600",
                  marginBottom: "16px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}
              >
                Institution
              </h3>
              <div
                onClick={() => navigate(`/institution/${institution.institution_id}`)}
                style={{
                  padding: "12px",
                  backgroundColor: colors.primary[500],
                  borderRadius: "8px",
                  cursor: "pointer",
                  transition: "background-color 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.primary[300];
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.primary[500];
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                  <Building2 style={{ width: "16px", height: "16px", color: colors.blueAccent[500] }} />
                  <span style={{ fontSize: "14px", color: colors.grey[100], fontWeight: "600" }}>
                    {institution.institution_name}
                  </span>
                </div>
                {(institution.city || institution.state) && (
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", paddingLeft: "28px" }}>
                    <MapPin style={{ width: "14px", height: "14px", color: colors.grey[400] }} />
                    <span style={{ fontSize: "13px", color: colors.grey[300] }}>
                      {[institution.city, institution.state].filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </Box>
          )}

          {/* Delete Account Button - Only for own profile */}
          {isOwnProfile && (
            <Box mt={3} pt={3} borderTop={`1px solid ${colors.primary[300]}`}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Trash2 size={18} />}
                onClick={() => setShowDeleteAccountModal(true)}
                sx={{
                  color: colors.redAccent[400],
                  borderColor: colors.redAccent[600],
                  fontWeight: 600,
                  py: 1.5,
                  borderRadius: '8px',
                  '&:hover': {
                    backgroundColor: colors.redAccent[900],
                    borderColor: colors.redAccent[500]
                  }
                }}
              >
                Delete Account
              </Button>
            </Box>
          )}
        </Box>

        {/* Right Column - Bio, Expertise, and Projects */}
        <Box gridColumn="span 8">
          {/* Bio Section */}
          {personData.bio && (
            <Box
              backgroundColor={colors.primary[400]}
              borderRadius="12px"
              border={`1px solid ${colors.primary[300]}`}
              padding="24px"
              marginBottom="20px"
            >
              <h3
                style={{
                  color: colors.grey[100],
                  fontSize: "16px",
                  fontWeight: "600",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
              >
                <User style={{ width: "20px", height: "20px" }} />
                Biography
              </h3>
              <p
                style={{
                  color: colors.grey[300],
                  fontSize: "14px",
                  lineHeight: "1.6"
                }}
              >
                {personData.bio}
              </p>
            </Box>
          )}

          {/* Expertise Section */}
          {personData.expertises && personData.expertises.length > 0 && (
            <Box
              backgroundColor={colors.primary[400]}
              borderRadius="12px"
              border={`1px solid ${colors.primary[300]}`}
              padding="24px"
              marginBottom="20px"
            >
              <h3
                style={{
                  color: colors.grey[100],
                  fontSize: "16px",
                  fontWeight: "600",
                  marginBottom: "16px"
                }}
              >
                Research Areas & Expertise
              </h3>
              <Box display="flex" flexWrap="wrap" gap="12px">
                {personData.expertises.map((exp, idx) => (
                  <span
                    key={idx}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: colors.blueAccent[800],
                      color: colors.blueAccent[200],
                      borderRadius: "12px",
                      fontSize: "13px",
                      fontWeight: "500"
                    }}
                  >
                    {exp}
                  </span>
                ))}
              </Box>
            </Box>
          )}

          {/* Projects Section */}
          <Box
            backgroundColor={colors.primary[400]}
            borderRadius="12px"
            border={`1px solid ${colors.primary[300]}`}
            padding="24px"
          >
            <Box 
              display="flex" 
              justifyContent="space-between" 
              alignItems="center" 
              marginBottom="16px"
            >
              <h3
                style={{
                  color: colors.grey[100],
                  fontSize: "16px",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
              >
                <BookOpen style={{ width: "20px", height: "20px" }} />
                Projects ({projects.length})
              </h3>
              
              {isOwnProfile && (
                <Button
                  variant="contained"
                  startIcon={<Plus size={16} />}
                  onClick={() => setShowAddProjectModal(true)}
                  sx={{
                    backgroundColor: colors.greenAccent[600],
                    color: colors.grey[100],
                    padding: '8px 16px',
                    fontSize: '14px',
                    '&:hover': { backgroundColor: colors.greenAccent[700] }
                  }}
                >
                  Add Project
                </Button>
              )}
            </Box>

            {projects.length === 0 ? (
              <p style={{ color: colors.grey[400], fontSize: "14px" }}>
                No projects found for this researcher.
              </p>
            ) : (
              <Box display="flex" flexDirection="column" gap="16px">
                {projects.map((project) => (
                  <Box
                    key={project.project_id}
                    padding="16px"
                    backgroundColor={colors.primary[500]}
                    borderRadius="8px"
                    border={`1px solid ${colors.primary[300]}`}
                    onClick={() => navigate(`/project/${project.project_id}`)}
                    style={{
                      transition: "all 0.2s",
                      cursor: "pointer"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateX(4px)";
                      e.currentTarget.style.borderColor = colors.blueAccent[500];
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateX(0)";
                      e.currentTarget.style.borderColor = colors.primary[300];
                    }}
                  >
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" marginBottom="8px">
                      <h4
                        style={{
                          color: colors.grey[100],
                          fontSize: "15px",
                          fontWeight: "600",
                          margin: 0,
                          flex: 1
                        }}
                      >
                        {project.project_title}
                      </h4>
                      
                      {isOwnProfile && (
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditProject(project);
                          }}
                          sx={{
                            padding: '4px',
                            color: colors.blueAccent[400],
                            '&:hover': { 
                              backgroundColor: colors.blueAccent[800],
                              color: colors.blueAccent[300]
                            }
                          }}
                          title="Edit Project"
                        >
                          <Edit size={16} />
                        </IconButton>
                      )}
                    </Box>

                    {project.project_description && (
                      <p
                        style={{
                          color: colors.grey[300],
                          fontSize: "13px",
                          marginBottom: "12px",
                          lineHeight: "1.5"
                        }}
                      >
                        {project.project_description}
                      </p>
                    )}

                    <Box
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Box display="flex" alignItems="center" gap="8px">
                        {(project.start_date || project.end_date) && (
                          <span
                            style={{
                              color: colors.grey[400],
                              fontSize: "12px"
                            }}
                          >
                            {project.start_date && new Date(project.start_date).getFullYear()}
                            {project.start_date && project.end_date && ' - '}
                            {project.end_date && new Date(project.end_date).getFullYear()}
                          </span>
                        )}
                      </Box>

                      <Box display="flex" alignItems="center" gap="8px">
                        {(() => {
                          // Determine project status
                          const hasNoDates = !project.start_date && !project.end_date;
                          const hasEndDate = project.end_date;
                          const isPastEndDate = hasEndDate && new Date(project.end_date) < new Date();
                          const isEnded = hasNoDates || isPastEndDate;
                          
                          return (
                            <span
                              style={{
                                padding: "2px 8px",
                                backgroundColor: isEnded ? colors.grey[700] : colors.greenAccent[800],
                                color: isEnded ? colors.grey[300] : colors.greenAccent[200],
                                borderRadius: "8px",
                                fontSize: "10px",
                                fontWeight: "600",
                                textTransform: "uppercase",
                                letterSpacing: "0.5px"
                              }}
                            >
                              {isEnded ? 'Ended' : 'Ongoing'}
                            </span>
                          );
                        })()}
                        
                        {project.tag_name && (
                          <span
                            style={{
                              padding: "4px 12px",
                              backgroundColor: colors.blueAccent[800],
                              color: colors.blueAccent[200],
                              borderRadius: "12px",
                              fontSize: "11px",
                              fontWeight: "500"
                            }}
                          >
                            {project.tag_name}
                          </span>
                        )}
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {/* Add Project Modal */}
      {isOwnProfile && (
        <AddProjectModal
          open={showAddProjectModal}
          onClose={() => setShowAddProjectModal(false)}
          userId={parseInt(localStorage.getItem('user_id'))}
          onProjectAdded={handleProjectAdded}
        />
      )}

      {/* Edit Project Modal */}
      {isOwnProfile && (
        <EditProjectModal
          open={showEditProjectModal}
          onClose={() => {
            setShowEditProjectModal(false);
            setSelectedProject(null);
          }}
          project={selectedProject}
          userId={parseInt(localStorage.getItem('user_id'))}
          onProjectUpdated={handleProjectUpdated}
          onProjectDeleted={handleProjectDeleted}
        />
      )}

      {/* Edit Profile Modal */}
      {isOwnProfile && (
        <EditProfileModal
          open={showEditProfileModal}
          onClose={() => setShowEditProfileModal(false)}
          person={personData}
          department={department}
          institution={institution}
          onProfileUpdated={async () => {
            // Refresh person data after update
            try {
              const response = await axios.get(`http://127.0.0.1:5001/person/${id}`);
              setPerson(response.data.data);
            } catch (err) {
              console.error('Error refreshing profile:', err);
            }
          }}
        />
      )}

      {/* Delete Account Modal */}
      {isOwnProfile && (
        <DeleteAccountModal
          open={showDeleteAccountModal}
          onClose={() => setShowDeleteAccountModal(false)}
          personId={personData.person_id}
          personName={personData.person_name}
          onAccountDeleted={() => {
            // Redirect to login page after successful account deletion
            navigate('/login');
          }}
        />
      )}
    </Box>
  );
};

export default Person;
