import axios from "axios";
import { createContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

export const AppContext = createContext();

const AppContextProvider = (props) => {
  const [user, setUser] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [credit, setCredit] = useState(null); // ✅ changed from false to null
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  const navigate = useNavigate();

  // ✅ Load user and credit details
const loadCreditData = async () => {
    try {
        console.log("Attempting to load credit data...");
        console.log("Token being sent:", token); // Check if token is present

        const { data } = await axios.get(backendUrl + "/api/user/credits", {
            headers: { token },
        });

        console.log("Response from /api/user/credits:", data); // Inspect the full response

        if (data.success) {
            setCredit(data.credits);
            setUser(data.user);
            console.log("Credits loaded successfully:", data.credits);
            console.log("User loaded successfully:", data.user);
        } else {
            console.log("Backend reported success: false. Message:", data.message);
            toast.error(data.message);
        }
    } catch (error) {
        console.error("Error loading credit data:", error); // Use console.error for errors
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.error("Error response data:", error.response.data);
            console.error("Error response status:", error.response.status);
            console.error("Error response headers:", error.response.headers);
            toast.error(`Error ${error.response.status}: ${error.response.data.message || error.message}`);
        } else if (error.request) {
            // The request was made but no response was received
            console.error("No response received:", error.request);
            toast.error("No response from server. Check network connection.");
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error("Axios request setup error:", error.message);
            toast.error("An unexpected error occurred.");
        }
    }
};

  // ✅ Image generation with credit deduction
  const generateImage = async (prompt) => {
    try {
      const { data } = await axios.post(
        backendUrl + "/api/image/generate-image",
        { prompt },
        { headers: { token } }
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

  // ✅ Logout resets all state
  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setCredit(null);
  };

  // ✅ Load credit on login
  useEffect(() => {
    if (token) {
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
    setCredit,
    setToken,
    credit,
    logout,
    generateImage,
  };

  return (
    <AppContext.Provider value={value}>
      {props.children}
    </AppContext.Provider>
  );
};

export default AppContextProvider;
