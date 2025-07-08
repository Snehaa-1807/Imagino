import jwt from "jsonwebtoken";

const userAuth = async (req, res, next) => {
    const token = req.headers.token; // Correct header name

    console.log("Auth Middleware: Received token:", token ? "Token present" : "No token"); // For debugging

    if (!token) {
        console.log("Auth Middleware: No token provided. Returning error."); // For debugging
        return res.json({ success: false, message: 'Not Authorized. Login Again (No token)' });
    }

    try {
        const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);
        console.log("Auth Middleware: Token decoded:", tokenDecode); // For debugging

        if (tokenDecode?.id) {
            // ⭐⭐⭐ THE FIX IS HERE ⭐⭐⭐
            // Attach userId directly to the request object, not req.body
            req.userId = tokenDecode.id;
            console.log("Auth Middleware: User ID attached to req.userId:", req.userId); // For debugging
            next(); // Call next if token is valid and ID is present
        } else {
            console.log("Auth Middleware: Decoded token has no ID. Returning error."); // For debugging
            return res.json({ success: false, message: 'Not Authorized. Login Again (Invalid token payload)' });
        }

    } catch (error) {
        console.error("Auth Middleware Error:", error.message); // Use console.error for errors
        if (error.name === 'TokenExpiredError') {
            return res.json({ success: false, message: 'Token Expired, Please Login Again' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.json({ success: false, message: 'Invalid Token, Please Login Again' });
        }
        return res.json({ success: false, message: error.message });
    }
};

export default userAuth;