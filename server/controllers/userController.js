import userModel from "../models/userModel.js";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import razorpay from 'razorpay'
import transactionModel from "../models/transactionModel.js";
import crypto from 'crypto';

// Ensure dotenv is configured in your main server file (e.g., app.js or server.js)
// import dotenv from "dotenv";
// dotenv.config();

const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.json({ success: false, message: 'Missing Details' });
        }

        const existingUser = await userModel.findOne({ email });
        if (existingUser) {
            return res.json({ success: false, message: 'User with this email already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const userData = {
            name,
            email,
            password: hashedPassword,
            creditBalance: 0 // Initialize credit balance for new users
        };

        const newUser = new userModel(userData);
        const user = await newUser.save();
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
        res.json({ success: true, token, user: { name: user.name, email: user.email, creditBalance: user.creditBalance } });
    } catch (error) {
        console.error("Error in registerUser:", error); // Use console.error for errors
        res.json({ success: false, message: error.message });
    }
};

const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await userModel.findOne({ email });
        if (!user) {
            return res.json({ success: false, message: "User does not exist" });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
            res.json({ success: true, token, user: { name: user.name, email: user.email, creditBalance: user.creditBalance } });
        } else {
            return res.json({ success: false, message: "Invalid credentials" });
        }
    } catch (error) {
        console.error("Error in loginUser:", error);
        res.json({ success: false, message: error.message });
    }
};

const userCredits = async(req,res)=>{
    // console.log("--> USER CREDITS CONTROLLER START <--"); // Debugging line from previous step
    try{
        // ⭐⭐⭐ THIS IS THE CRUCIAL CHANGE ⭐⭐⭐
        // Get userId directly from the request object, as set by userAuth middleware
        const userId = req.userId;

        // console.log("userCredits Controller: Value of req.userId:", userId); // Debugging line
        // console.log("userCredits Controller: Full req.body:", req.body); // Debugging line
        // console.log("userCredits Controller: Type of req.userId:", typeof userId); // Debugging line

        if (!userId) {
            // This should ideally not be hit if userAuth works and is applied
            // console.error("userCredits Controller: userId is UNDEFINED. THIS IS THE PROBLEM SOURCE."); // Debugging line
            return res.json({ success: false, message: "User ID missing after authentication." });
        }
        // Basic check for valid MongoDB ID format if needed
        if (typeof userId !== 'string' || userId.length !== 24) {
            // console.error("userCredits Controller: userId is not a valid format:", userId); // Debugging line
            return res.json({ success: false, message: "Invalid User ID format." });
        }

        const user = await userModel.findById(userId)
        if (!user) {
            // console.log("userCredits Controller: User not found in database for ID:", userId); // Debugging line
            return res.json({ success: false, message: "User not found." });
        }

        // console.log("userCredits Controller: User found. Credit Balance:", user.creditBalance); // Debugging line

        res.json({success: true, credits: user.creditBalance, user:{name: user.name}})
    }
    catch (error){
        console.error("Error in userCredits Controller:", error); // Use console.error
        res.json({ success: false, message: error.message });
    }
}

const razorpayInstance = new razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
})

const verifyRazorpay = async (req, res) => {
    try {
        console.log("verifyRazorpay: Full request body:", req.body);
        console.log("verifyRazorpay: req.userId:", req.userId);

        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            console.error("verifyRazorpay: Missing required fields");
            return res.json({ success: false, message: 'Missing payment details' });
        }

        console.log("verifyRazorpay: Received verification request for order ID:", razorpay_order_id);

        // Verify the signature first (IMPORTANT for security)
        const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
        hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
        const generatedSignature = hmac.digest('hex');

        if (generatedSignature !== razorpay_signature) {
            console.error("verifyRazorpay: Signature mismatch for order ID:", razorpay_order_id);
            console.error("verifyRazorpay: Expected:", generatedSignature);
            console.error("verifyRazorpay: Received:", razorpay_signature);
            return res.json({ success: false, message: 'Payment verification failed: Signature mismatch.' });
        }

        console.log("verifyRazorpay: Signature verified successfully");

        // Fetch order information from Razorpay
        const orderInfo = await razorpayInstance.orders.fetch(razorpay_order_id);
        console.log("verifyRazorpay: Order info from Razorpay:", orderInfo);

        if (orderInfo.status === 'paid') {
            console.log("verifyRazorpay: Order is paid, processing transaction...");
            
            const transactionData = await transactionModel.findById(orderInfo.receipt);

            if (!transactionData) {
                console.error("verifyRazorpay: Transaction data not found for receipt:", orderInfo.receipt);
                return res.json({ success: false, message: 'Transaction record not found.' });
            }

            console.log("verifyRazorpay: Transaction data found:", transactionData);

            if (transactionData.payment) {
                console.log("verifyRazorpay: Payment already processed for transaction ID:", transactionData._id);
                return res.json({ success: false, message: 'Payment already processed.' });
            }

            const userData = await userModel.findById(transactionData.userId);
            if (!userData) {
                console.error("verifyRazorpay: User data not found for userId:", transactionData.userId);
                return res.json({ success: false, message: 'User associated with transaction not found.' });
            }

            console.log("verifyRazorpay: Current user credit balance:", userData.creditBalance);
            console.log("verifyRazorpay: Credits to add:", transactionData.credits);

            const creditBalance = userData.creditBalance + transactionData.credits;
            
            // Update user credits
            await userModel.findByIdAndUpdate(userData._id, { creditBalance });
            
            // Update transaction as paid
            await transactionModel.findByIdAndUpdate(transactionData._id, { 
                payment: true, 
                razorpay_payment_id, 
                razorpay_signature 
            });

            console.log("verifyRazorpay: Credits added successfully for user:", userData._id, "New balance:", creditBalance);
            return res.json({ success: true, message: 'Credits Added' });

        } else {
            console.log("verifyRazorpay: Order status is not 'paid':", orderInfo.status);
            return res.json({ success: false, message: 'Payment Failed: Order not paid.' });
        }
    } catch (error) {
        console.error("Error in verifyRazorpay:", error);
        return res.json({ success: false, message: error.message });
    }
}

export { registerUser, loginUser, userCredits, paymentRazorpay, verifyRazorpay };