import userModel from "../models/userModel.js";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import razorpay from 'razorpay'
import transactionModel from "../models/transactionModel.js";

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

const paymentRazorpay = async (req, res) => {
    try {
        const { userId, planId } = req.body; // userId is expected from req.body for payment initiation

        if (!userId || !planId) {
            return res.json({ success: false, message: "Missing Details" });
        }

        let credits, plan, amount, date;

        switch (planId) {
            case "Basic":
                plan = "Basic";
                credits = 100;
                amount = 10;
                break;

            case "Advanced":
                plan = "Advanced";
                credits = 500;
                amount = 50;
                break;

            case "Business":
                plan = "Business";
                credits = 5000;
                amount = 250;
                break;

            default:
                return res.json({ success: false, message: "Plan not found" });
        }

        date = Date.now();

        const transactionData = {
            userId,
            plan,
            amount,
            credits,
            date,
            payment: false // Initialize payment status
        };

        const newTransaction = await transactionModel.create(transactionData);
        console.log("PaymentRazorpay: New transaction created with ID:", newTransaction._id);

        const options = {
            amount: amount * 100, // amount in smallest currency unit (e.g., paisa for INR)
            currency: process.env.CURRENCY,
            receipt: newTransaction._id.toString(), // Convert ObjectId to string
        };

        console.log("PaymentRazorpay: Creating Razorpay order with options:", options);

        razorpayInstance.orders.create(options, (error, order) => {
            if (error) {
                console.error("PaymentRazorpay: Error creating Razorpay order:", error);
                return res.json({ success: false, message: error.message || "Failed to create order" });
            }
            console.log("PaymentRazorpay: Razorpay order created:", order);
            res.json({ success: true, order });
        });
    } catch (error) {
        console.error("Error in paymentRazorpay:", error);
        res.json({ success: false, message: error.message });
    }
};

const verifyRazorpay = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        console.log("verifyRazorpay: Received verification request for order ID:", razorpay_order_id);

        const orderInfo = await razorpayInstance.orders.fetch(razorpay_order_id);

        if (orderInfo.status === 'paid') {
            const transactionData = await transactionModel.findById(orderInfo.receipt);

            if (!transactionData) {
                console.error("verifyRazorpay: Transaction data not found for receipt:", orderInfo.receipt);
                return res.json({ success: false, message: 'Transaction record not found.' });
            }

            if (transactionData.payment) {
                console.log("verifyRazorpay: Payment already processed for transaction ID:", transactionData._id);
                return res.json({ success: false, message: 'Payment already processed.' });
            }

            // --- IMPORTANT: Razorpay Signature Verification ---
            // It's crucial to verify the signature for security.
            // You'll need to import 'crypto' at the top of this file: `import crypto from 'crypto';`
            /*
            import crypto from 'crypto';
            const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
            hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
            const generatedSignature = hmac.digest('hex');

            if (generatedSignature !== razorpay_signature) {
                console.error("verifyRazorpay: Signature mismatch for order ID:", razorpay_order_id);
                return res.json({ success: false, message: 'Payment verification failed: Signature mismatch.' });
            }
            */
            // --- End of Signature Verification ---

            const userData = await userModel.findById(transactionData.userId);
            if (!userData) {
                console.error("verifyRazorpay: User data not found for userId:", transactionData.userId);
                return res.json({ success: false, message: 'User associated with transaction not found.' });
            }

            const creditBalance = userData.creditBalance + transactionData.credits;
            await userModel.findByIdAndUpdate(userData._id, { creditBalance });
            await transactionModel.findByIdAndUpdate(transactionData._id, { payment: true, razorpay_payment_id, razorpay_signature });

            console.log("verifyRazorpay: Credits added successfully for user:", userData._id, "New balance:", creditBalance);
            return res.json({ success: true, message: 'Credits Added' });

        } else {
            console.log("verifyRazorpay: Order status is not 'paid':", orderInfo.status);
            return res.json({ success: false, message: 'Payment Failed: Order not paid.' });
        }
    } catch (error) {
        console.error("Error in verifyRazorpay:", error);
        res.json({ success: false, message: error.message });
    }
}

export { registerUser, loginUser, userCredits, paymentRazorpay, verifyRazorpay };