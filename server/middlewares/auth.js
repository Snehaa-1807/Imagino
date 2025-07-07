import jwt from "jsonwebtoken";

const userAuth = async (req, res, next) => {
    const token = req.headers.token; // ✅ Correct header name

    if (!token) {
        return res.json({ success: false, message: 'Not Authorized. Login Again' }); // ❌ Fixed: 'sucess' → 'success'
    }

    try {
        const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);

        if (tokenDecode?.id) {
            req.body.userId = tokenDecode.id;
            next(); // ✅ Call next if token is valid
        } else {
            return res.json({ success: false, message: 'Not Authorized. Login Again' });
        }

    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

export default userAuth;
