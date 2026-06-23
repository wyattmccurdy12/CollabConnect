/*
  author: Lucas Matheson
  edited by: Lucas Matheson
  date: November 20th, 2025
  description: Main application component setting up theme, routing, and layout.
*/
import { ColorModeContext, useMode } from "./theme";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { Route, Routes } from "react-router-dom";
import Topbar from "./scenes/global/Topbar";
import Dashboard from "./scenes/dashboard";
import Sidebar from "./scenes/global/Sidebar";

import SearchCollab from "./scenes/SearchCollab";
import SearchProjects from "./scenes/project";
import ProjectDetail from "./scenes/project/Detail";
import Person from "./scenes/person";
import Department from "./scenes/department";
import Analytics from "./scenes/analytics";
import Login from "./scenes/login";
import Register from "./scenes/register";
import VerifyEmail from "./scenes/verify-email";
import User from "./scenes/user";
import Institution from "./scenes/Institution";
import DataCollection from "./scenes/data-collection";
import Faq from "./scenes/faq";
import Settings from "./scenes/settings";
import Connections from "./scenes/connections";
import ClaimProfile from "./scenes/claim-profile";
import CreateProfile from "./scenes/create-profile";
import Messages from "./scenes/messages";
import AdminAnalytics from "./scenes/admin-analytics";
function App() {
  const [theme, colorMode] = useMode();
  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <div className="app" style={{ display: "flex", minHeight: "100vh" }}>
          <Sidebar/>
          <main className="content" style={{ flex: 1 }}>
            <Topbar />
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/connections" element={<Connections />} />
              <Route path="/search" element={<SearchCollab />} />
              <Route path="/project/:id" element={<ProjectDetail />} />
              <Route path="/projects" element={<SearchProjects />} />
              <Route path="/analytics" element={<Analytics />} />

              <Route path="/person/:id" element={<Person />} />
              <Route path="/institution/:id" element={<Institution />} />
              <Route path="/department/:id" element={<Department />} />

              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/user/:id" element={<User />} />

              <Route path="/claim-profile" element={<ClaimProfile />} />
              <Route path="/create-profile" element={<CreateProfile />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/admin/analytics" element={<AdminAnalytics />} />

              <Route path="/data-collection" element={<DataCollection />} />
              <Route path="/faq" element={<Faq/>} />
              <Route path="/settings" element={<Settings/>} />

            </Routes>
          </main>
        </div>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
export default App;