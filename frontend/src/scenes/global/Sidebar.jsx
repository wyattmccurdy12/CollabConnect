/*
  author: Lucas Matheson
  edited by: Lucas Matheson
  date: November 20th, 2025
  description: Sidebar component for navigation within the CollabConnect application.
*/
import { useState, useEffect } from "react";
import { ProSidebar, Menu, MenuItem } from "react-pro-sidebar";
import { Box, IconButton, Typography, useTheme } from "@mui/material";
import { useNavigate } from "react-router-dom";
import "react-pro-sidebar/dist/css/styles.css";
import { tokens } from "../../theme";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import MenuOutlinedIcon from "@mui/icons-material/MenuOutlined";
import NetworkCheckIcon from "@mui/icons-material/NetworkCheck";
import { Users } from "lucide-react";
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import { useLocation } from "react-router-dom";

const Item = ({ title, to, icon, selected, setSelected }) => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const navigate = useNavigate();
  
  return (
    <MenuItem
      active={selected === title}
      style={{
        color: colors.grey[100],
      }}
      onClick={() => {
        setSelected(title);
        navigate(to);
      }}
      icon={icon}
    >
      <Typography>{title}</Typography>
    </MenuItem>
  );
};

const Sidebar = () => {
  const location = useLocation();
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selected, setSelected] = useState();

  // Add in your page details here 
  useEffect(() => {
    const pathToMenu = {
      "/search": "Search Collaberators",
      "/projects": "Search Projects",
      "/connections": "Manage Connections",
      "/messages": "Messages",
      "/": "Dashboard",
    };

    setSelected(pathToMenu[location.pathname]);
  }, [location.pathname]);

  return (
    <Box
      sx={{
        width: isCollapsed ? "5rem" : "clamp(16.875rem, 14vw, 25rem)",
        minHeight: "100vh",
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
        transition: "width 0.3s",
        "& .pro-sidebar": {
          height: "100%",
          width: "100% !important",
        },
        "& .pro-sidebar-inner": {
          background: `${colors.primary[400]} !important`,
          height: "100%",
          width: "100% !important",
        },
        "& .pro-icon-wrapper": {
          backgroundColor: "transparent !important",
          display: "flex !important",
          alignItems: "center !important",
          justifyContent: "center !important",
          marginRight: "0 !important",
        },
        "& .pro-sidebar.collapsed .pro-icon-wrapper": {
          margin: "0 auto !important",
        },
        "& .pro-sidebar.collapsed .pro-inner-item": {
          justifyContent: "center !important",
          padding: "0.3125rem 0 !important",
        },
        "& .pro-inner-item": {
          padding: "0.3125rem 1.25rem 0.3125rem 1.25rem !important",
          display: "flex !important",
          alignItems: "center !important",
        },
        "& .pro-item-content": {
          display: "flex !important",
          alignItems: "center !important",
        },
        "& .pro-sidebar.collapsed .pro-item-content": {
          display: "none !important",
        },
        "& .pro-inner-item:hover": {
          color: "#868dfb !important",
        },
        "& .pro-menu-item.active": {
          color: "#6870fa !important",
        },
      }}
    >
      <ProSidebar collapsed={isCollapsed}>
        <Menu iconShape="square">
          {/* LOGO AND MENU ICON */}
          <MenuItem
            onClick={() => setIsCollapsed(!isCollapsed)}
            icon={isCollapsed ? <MenuOutlinedIcon /> : undefined}
            style={{
              margin: "0.625rem 0 1.25rem 0",
              color: colors.grey[100],
            }}
          >
            {!isCollapsed && (
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                gap="0.625rem"
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                  }}
                >
                  <Users
                    style={{
                      width: "2rem",
                      height: "2rem",
                      color: colors.blueAccent[500],
                    }}
                  />
                  <div>
                    <h2
                      style={{
                        color: colors.grey[100],
                        fontSize: "1.25rem",
                        fontWeight: "bold",
                        margin: 0,
                      }}
                    >
                      CollabConnect
                    </h2>
                    <p
                      style={{
                        color: colors.grey[300],
                        fontSize: "0.75rem",
                        margin: 0,
                      }}
                    >
                      Discover Excellence
                    </p>
                  </div>
                </div>
                <IconButton onClick={() => setIsCollapsed(!isCollapsed)}>
                  <MenuOutlinedIcon />
                </IconButton>
              </Box>
            )}
          </MenuItem>

          {/* DEFINE YOUR ROUTE PUSHES HERE  */}
          <Box paddingLeft={isCollapsed ? undefined : "10%"}>
            <Typography
              variant="h6"
              color={colors.grey[300]}
              sx={{ 
                m: "0.9375rem 0 0.3125rem 1.25rem",
                display: isCollapsed ? "none" : "block"
              }}
            >
              Home
            </Typography>
            <Item
              title="Dashboard"
              to="/"
              icon={<HomeOutlinedIcon />}
              selected={selected}
              setSelected={setSelected}
            />

            <Typography
              variant="h6"
              color={colors.grey[300]}
              sx={{ 
                m: "0.9375rem 0 0.3125rem 1.25rem",
                display: isCollapsed ? "none" : "block"
              }}
            >
              Connect
            </Typography>

            <Item
              title="Manage Connections"
              to="/connections"
              icon={<PeopleOutlinedIcon />}
              selected={selected}
              setSelected={setSelected}
            />
            <Item
              title="Search Collaberators"
              to="/search"
              icon={<PersonSearchIcon />}
              selected={selected}
              setSelected={setSelected}
            />
            <Item
              title="Messages"
              to="/messages"
              icon={<ForumOutlinedIcon />}
              selected={selected}
              setSelected={setSelected}
            />
            <Item
              title="Search Projects"
              to="/projects"
              icon={<FolderOpenIcon />}
              selected={selected}
              setSelected={setSelected}
            />

            <Typography
              variant="h6"
              color={colors.grey[300]}
              sx={{ 
                m: "0.9375rem 0 0.3125rem 1.25rem",
                display: isCollapsed ? "none" : "block"
              }}
            >
              Analytics
            </Typography>

            <Item
              title="Network Visualization"
              to="/analytics"
              icon={<NetworkCheckIcon />}
              selected={selected}
              setSelected={setSelected}
            />

            <Typography
              variant="h6"
              color={colors.grey[300]}
              sx={{ 
                m: "15px 0 5px 20px",
                display: isCollapsed ? "none" : "block"
              }}
            >
              Data
            </Typography>

            <Item
              title="Data Collection"
              to="/data-collection"
              icon={<CalendarTodayOutlinedIcon />}
              selected={selected}
              setSelected={setSelected}
            />
            <Item
              title="FAQ Page"
              to="/faq"
              icon={<HelpOutlineOutlinedIcon />}
              selected={selected}
              setSelected={setSelected}
            />
           
          </Box>
        </Menu>
      </ProSidebar>
    </Box>
  );
};

export default Sidebar;