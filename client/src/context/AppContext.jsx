import axios from "axios";
import { createContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

export const AppContext = createContext();

const AppContextProvider = (props) => {
  const [user, setUser] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [credit, setCredit] = useState(null);
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  const navigate = useNavigate();

  // ✅ Load user and credit details using token
  const loadCreditData = async () => {
    try {
      const storedToken = token || localStorage.getItem("token");
      if (!storedToken) {
        console.warn("🔑 No token found, skipping credit fetch.");
        return;
      }

      console.log("Attempting to load credit data...");
      console.log("Token being sent:", storedToken);

      const { data } = await axios.get(`${backendUrl}/api/user/credits`, {
        headers: { token: storedToken },
      });

      if (data.success) {
        setCredit(data.credits);
        setUser(data.user);
        console.log("✅ Credits loaded:", data.credits);
        console.log("✅ User loaded:", data.user);
      } else {
        console.warn("⚠️ Backend error:", data.message);
        toast.error(data.message);
      }
    } catch (error) {
      console.error("❌ Error loading credit data:", error);
      if (error.response) {
        toast.error(`Error ${error.response.status}: ${error.response.data.message || error.message}`);
      } else if (error.request) {
        toast.error("No response from server. Check network connection.");
      } else {
        toast.error("An unexpected error occurred.");
      }
    }
  };

  // ✅ Generate image and deduct credit
  const generateImage = async (prompt) => {
    try {
      const storedToken = token || localStorage.getItem("token");
      const { data } = await axios.post(
        `${backendUrl}/api/image/generate-image`,
        { prompt },
        { headers: { token: storedToken } }
      );

      if (data.success) {
        loadCreditData();
        return data.resultImage;
      } else {
        toast.error(data.message);
        loadCreditData();
        if (data.creditBalance === 0) {
          navigate("/buy");
        }
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  // ✅ Login helper to store token and update state
  const loginUserSession = (token, user) => {
    localStorage.setItem("token", token);
    setToken(token);
    setUser(user);
    loadCreditData();
  };

  // ✅ Logout resets all state
  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setCredit(null);
  };

  // ✅ Load credit on first token load
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (storedToken && !token) {
      setToken(storedToken);
    }
    if (storedToken) {
      loadCreditData();
    }
  }, [token]);

  const value = {
    user,
    setUser,
    showLogin,
    setShowLogin,
    backendUrl,
    token,
    setToken,
    credit,
    setCredit,
    logout,
    loginUserSession, // ✅ added for login use
    generateImage,
  };

  return (
    <AppContext.Provider value={value}>
      {props.children}
    </AppContext.Provider>
  );
};

export default AppContextProvider;
