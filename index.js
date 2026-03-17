const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// In-memory store for OTPs (In production, use Redis/Database)
const otpStore = {};

// In-memory store for users (In production, use Database)
const users = [
    { name: 'Admin',        email: 'admin@gmail.com',        password: 'admin123',   role: 'admin'   },
    // Trainer accounts — emails match ViewTrainers.jsx
    { name: 'Priya Sharma', email: 'priya.sharma@gmail.com', password: 'trainer123', role: 'trainer', specialty: 'nutrition', goals: ['weight-loss', 'wellness'], availability: 'morning' },
    { name: 'Arjun Mehta',  email: 'arjun.mehta@gmail.com',  password: 'trainer123', role: 'trainer', specialty: 'strength', goals: ['muscle-gain', 'strength'], availability: 'evening' },
    { name: 'Sneha Patel',  email: 'sneha.patel@gmail.com',  password: 'trainer123', role: 'trainer', specialty: 'yoga', goals: ['flexibility', 'wellness'], availability: 'afternoon' },
    { name: 'Ravi Kumar',   email: 'ravi.kumar@gmail.com',   password: 'trainer123', role: 'trainer', specialty: 'cardio', goals: ['weight-loss', 'endurance'], availability: 'morning' },
    { name: 'Ananya Singh', email: 'ananya.singh@gmail.com', password: 'trainer123', role: 'trainer', specialty: 'rehab', goals: ['flexibility', 'rehab'], availability: 'evening' },
    { name: 'Karan Joshi',  email: 'karan.joshi@gmail.com',  password: 'trainer123', role: 'trainer', specialty: 'general', goals: ['wellness', 'fitness'], availability: 'afternoon' },
];

// In-memory store for Health Blog
let blogs = [
    {
        id: 'b1',
        title: "5 Tips for Sustainable Weight Loss",
        content: "Discover how to lose weight and keep it off by focusing on small, consistent changes in your nutrition and activity levels...",
        authorName: "Priya Sharma",
        authorEmail: "priya.sharma@gmail.com",
        authorRole: "trainer",
        category: "Nutrition",
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        likes: ["admin@gmail.com"],
        tags: ["weight-loss", "nutrition"]
    },
    {
        id: 'b2',
        title: "The Importance of Morning Yoga",
        content: "Starting your day with just 15 minutes of yoga can transform your mental clarity and physical flexibility...",
        authorName: "Sneha Patel",
        authorEmail: "sneha.patel@gmail.com",
        authorRole: "trainer",
        category: "Wellness",
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        likes: [],
        tags: ["yoga", "wellness"]
    }
];

let blogComments = [
    {
        id: 'c1',
        blogId: 'b1',
        content: "Great article! Very helpful.",
        authorName: "Rajesh Kumar",
        authorEmail: "rajesh.k@gmail.com",
        createdAt: new Date(Date.now() - 43200000).toISOString(),
    }
];

// In-memory store for Health Feed posts
let posts = [
    {
        id: 'p1',
        content: "Just finished a 10km run! Feeling amazing. Consistency is key! 🏃‍♂️💪",
        authorName: "Arjun Mehta",
        authorEmail: "arjun.mehta@gmail.com",
        authorRole: "trainer",
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        likes: ["priya.sharma@gmail.com"]
    },
    {
        id: 'p2',
        content: "Anyone have tips for better sleep hygiene? 😴",
        authorName: "Deepa Patel",
        authorEmail: "deepa.p@gmail.com",
        authorRole: "user",
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        likes: []
    }
];

// Nodemailer Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Verify Transporter
transporter.verify((error, success) => {
    if (error) {
        console.log('Error with email server:', error);
    } else {
        console.log('Email server is ready to take messages');
    }
});

// Helper to generate 6-digit OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Route: Send OTP
app.post('/api/send-otp', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const otp = generateOTP();
    otpStore[email] = {
        otp,
        expires: Date.now() + 10 * 60 * 1000 // 10 minutes expiry
    };

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Password Reset OTP - Health & Wellness',
        text: `Your OTP for password reset is: ${otp}. It is valid for 10 minutes.`
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`OTP sent to ${email}`);
        res.json({ success: true, message: 'OTP sent successfully' });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ success: false, message: 'Failed to send OTP' });
    }
});

// Route: Verify OTP
app.post('/api/verify-otp', (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    const record = otpStore[email];

    if (!record) {
        return res.status(400).json({ success: false, message: 'OTP not found. Request a new one.' });
    }

    if (Date.now() > record.expires) {
        delete otpStore[email];
        return res.status(400).json({ success: false, message: 'OTP expired' });
    }

    if (record.otp === otp) {
        delete otpStore[email]; // Clear OTP after success
        // In a real app, you might issue a temporary token here to allow password reset
        res.json({ success: true, message: 'OTP verified successfully' });
    } else {
        res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
});

// Route: Check Email
app.post('/api/check-email', (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required' });
    }
    const userExists = users.some(u => u.email === email);
    res.json({ success: userExists });
});

// Route: Register
app.post('/api/register', (req, res) => {
    const userData = req.body;
    if (!userData.email || !userData.password) {
        return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    if (users.find(u => u.email === userData.email)) {
        return res.status(400).json({ success: false, message: 'User already exists' });
    }
    users.push(userData);
    res.json({ success: true, message: 'User registered successfully' });
});

// Route: Login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    const foundUser = users.find(u => u.email === email && u.password === password);
    if (foundUser) {
        const { password, ...userWithoutPassword } = foundUser;
        return res.json({ success: true, user: userWithoutPassword });
    }
    res.status(401).json({ success: false, message: 'Invalid email or password' });
});

// Route: Reset Password
app.post('/api/reset-password', (req, res) => {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
        return res.status(400).json({ success: false, message: 'Email and new password are required' });
    }
    const userIndex = users.findIndex(u => u.email === email);
    if (userIndex !== -1) {
        users[userIndex].password = newPassword;
        return res.json({ success: true, message: 'Password reset successfully' });
    }
    res.status(404).json({ success: false, message: 'User not found' });
});

// Social Feed Routes
app.get('/api/posts', (req, res) => {
    // Sort by date descending (newest first)
    const sorted = [...posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(sorted);
});

app.post('/api/posts', (req, res) => {
    const { content, authorName, authorEmail, authorRole } = req.body;
    if (!content || !authorName || !authorEmail) {
        return res.status(400).json({ success: false, message: 'Missing post fields' });
    }
    const newPost = {
        id: 'p' + Date.now(),
        content,
        authorName,
        authorEmail,
        authorRole: authorRole || 'user',
        createdAt: new Date().toISOString(),
        likes: []
    };
    posts.unshift(newPost);
    res.json({ success: true, post: newPost });
});

app.post('/api/posts/:id/like', (req, res) => {
    const { id } = req.params;
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false });

    const post = posts.find(p => p.id === id);
    if (!post) return res.status(404).json({ success: false });

    const likeIdx = post.likes.indexOf(email);
    if (likeIdx === -1) {
        post.likes.push(email);
    } else {
        post.likes.splice(likeIdx, 1);
    }
    res.json({ success: true, likes: post.likes });
});

// Blog Routes
app.get('/api/blogs', (req, res) => {
    res.json(blogs);
});

app.get('/api/blogs/:id', (req, res) => {
    const blog = blogs.find(b => b.id === req.params.id);
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });
    const comments = blogComments.filter(c => c.blogId === req.params.id);
    res.json({ ...blog, comments });
});

app.post('/api/blogs', (req, res) => {
    const { title, content, authorName, authorEmail, authorRole, category, tags } = req.body;
    if (!title || !content || !authorName || !authorEmail) {
        return res.status(400).json({ success: false, message: 'Missing fields' });
    }
    console.log(`Blog creation request from ${authorEmail} (${authorRole})`);
    const newBlog = {
        id: 'b' + Date.now(),
        title,
        content,
        authorName,
        authorEmail,
        authorRole: authorRole || 'user',
        category: category || 'General',
        tags: tags || [],
        createdAt: new Date().toISOString(),
        likes: []
    };
    blogs.unshift(newBlog);
    res.json({ success: true, blog: newBlog });
});

app.put('/api/blogs/:id', (req, res) => {
    const { id } = req.params;
    const { title, content, category, tags, authorEmail } = req.body;
    const blog = blogs.find(b => b.id === id);
    if (!blog) return res.status(404).json({ success: false });

    // Moderation check: only author can edit
    if (blog.authorEmail !== authorEmail) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (title) blog.title = title;
    if (content) blog.content = content;
    if (category) blog.category = category;
    if (tags) blog.tags = tags;

    res.json({ success: true, blog });
});

app.delete('/api/blogs/:id', (req, res) => {
    const { id } = req.params;
    const { authorEmail } = req.body; // Pass in body for delete permission check
    const blogIdx = blogs.findIndex(b => b.id === id);
    if (blogIdx === -1) return res.status(404).json({ success: false });

    const blog = blogs[blogIdx];
    if (blog.authorEmail !== authorEmail) {
        const user = users.find(u => u.email === authorEmail);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
    }

    blogs.splice(blogIdx, 1);
    res.json({ success: true });
});

app.post('/api/blogs/:id/like', (req, res) => {
    const { id } = req.params;
    const { email } = req.body;
    const blog = blogs.find(b => b.id === id);
    if (!blog) return res.status(404).json({ success: false });

    const idx = blog.likes.indexOf(email);
    if (idx === -1) blog.likes.push(email);
    else blog.likes.splice(idx, 1);

    res.json({ success: true, likes: blog.likes });
});

app.post('/api/blogs/:id/comment', (req, res) => {
    const { id } = req.params;
    const { content, authorName, authorEmail } = req.body;
    if (!content || !authorName || !authorEmail) return res.status(400).json({ success: false });

    const newComment = {
        id: 'c' + Date.now(),
        blogId: id,
        content,
        authorName,
        authorEmail,
        createdAt: new Date().toISOString()
    };
    blogComments.push(newComment);
    res.json({ success: true, comment: newComment });
});

// Trainer Matching System
app.post('/api/match-trainers', (req, res) => {
    const { goals, availability } = req.body;
    if (!goals || !Array.isArray(goals)) return res.status(400).json({ success: false });

    const matches = users
        .filter(u => u.role === 'trainer')
        .map(t => {
            let score = 0;
            const matchedGoals = t.goals ? t.goals.filter(g => goals.includes(g)) : [];
            score += matchedGoals.length * 10;
            
            if (availability && t.availability === availability) {
                score += 5;
            }

            return { 
                ...t, 
                matchScore: score,
                matchReasons: matchedGoals.map(g => `Specializes in ${g.replace('-', ' ')}`)
            };
        })
        .sort((a, b) => b.matchScore - a.matchScore)
        .filter(t => t.matchScore > 0);

    res.json(matches);
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
