const multer = require('multer');
const fs = require('fs');
const path = require('path');
const db = require('../db'); // Adjust if your db is in a different path
const { authenticateToken } = require('../middleware/authMiddleware'); // Adjust path
const app = express();


//InternShip - PostgreSQL Compatible Version

// File upload configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images and documents are allowed'));
    }
  }
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

// Helper function to calculate days remaining
const calculateDaysRemaining = (endDate) => {
  const today = new Date();
  const end = new Date(endDate);
  const diffTime = end - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

// ============= DASHBOARD ROUTES =============

// Get dashboard data for authenticated intern
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    const internId = req.user.id;

    // Get intern basic info
    const internResult = await db.query(
      'SELECT full_name, email, status, progress, start_date, end_date FROM interns WHERE id = $1',
      [internId]
    );

    if (internResult.rows.length === 0) {
      return res.status(404).json({ message: 'Intern not found' });
    }

    const intern = internResult.rows[0];

    // Get tasks statistics
    const taskStatsResult = await db.query(
      `SELECT 
        COUNT(*) as total_tasks,
        SUM(CASE WHEN status IN ('completed', 'submitted') THEN 1 ELSE 0 END) as completed_tasks,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_tasks
      FROM tasks WHERE assigned_to = $1`,
      [internId]
    );

    // Get next upcoming deadline
    const upcomingTaskResult = await db.query(
      'SELECT title, due_date FROM tasks WHERE assigned_to = $1 AND due_date > CURRENT_TIMESTAMP ORDER BY due_date ASC LIMIT 1',
      [internId]
    );

    // Calculate days remaining
    const daysRemaining = intern.end_date ? calculateDaysRemaining(intern.end_date) : 0;

    // Calculate certificate progress based on completed tasks
    const taskStats = taskStatsResult.rows[0];
    const certificateProgress = parseInt(taskStats.total_tasks) > 0 
      ? Math.round((parseInt(taskStats.completed_tasks) / parseInt(taskStats.total_tasks)) * 100)
      : 0;

    // Format upcoming deadline
    const upcomingDeadline = upcomingTaskResult.rows.length > 0 
      ? `${new Date(upcomingTaskResult.rows[0].due_date).toLocaleDateString()} – ${upcomingTaskResult.rows[0].title}`
      : 'No upcoming deadlines';

    res.json({
      internData: {
        name: intern.full_name,
        profilePhoto: null,
        trainingEndDate: intern.end_date ? new Date(intern.end_date).toLocaleDateString() : 'Not set',
        tasksCompleted: parseInt(taskStats.completed_tasks),
        totalTasks: parseInt(taskStats.total_tasks),
        daysRemaining,
        upcomingDeadline,
        certificateProgress
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ============= TASK ROUTES =============

// Get all tasks for authenticated intern
app.get('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const internId = req.user.id;

    const tasksResult = await db.query(
      `SELECT 
        id, title, description, status, due_date, created_at, 
        submission_text, submission_file_path, feedback, grade
      FROM tasks 
      WHERE assigned_to = $1 
      ORDER BY due_date ASC`,
      [internId]
    );

    const formattedTasks = tasksResult.rows.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      assignedDate: new Date(task.created_at).toISOString().split('T')[0],
      dueDate: new Date(task.due_date).toISOString().split('T')[0],
      status: task.status.charAt(0).toUpperCase() + task.status.slice(1).replace('_', ' '),
      submissionText: task.submission_text,
      submissionFile: task.submission_file_path,
      feedback: task.feedback,
      grade: task.grade
    }));

    res.json(formattedTasks);
  } catch (error) {
    console.error('Tasks fetch error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get single task details
app.get('/api/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const taskId = req.params.id;
    const internId = req.user.id;

    const tasksResult = await db.query(
      'SELECT * FROM tasks WHERE id = $1 AND assigned_to = $2',
      [taskId, internId]
    );

    if (tasksResult.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json(tasksResult.rows[0]);
  } catch (error) {
    console.error('Task details error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Submit task
app.post('/api/tasks/:id/submit', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const taskId = req.params.id;
    const internId = req.user.id;
    const { submissionText } = req.body;

    // Check if task exists and belongs to intern
    const tasksResult = await db.query(
      'SELECT id FROM tasks WHERE id = $1 AND assigned_to = $2',
      [taskId, internId]
    );

    if (tasksResult.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Prepare update query
    let updateQuery = 'UPDATE tasks SET submission_text = $1, status = $2, updated_at = CURRENT_TIMESTAMP';
    let updateParams = [submissionText, 'submitted'];
    let paramIndex = 3;

    // Add file path if file was uploaded
    if (req.file) {
      updateQuery += `, submission_file_path = $${paramIndex}`;
      updateParams.push(req.file.path);
      paramIndex++;
    }

    updateQuery += ` WHERE id = $${paramIndex} AND assigned_to = $${paramIndex + 1}`;
    updateParams.push(taskId, internId);

    await db.query(updateQuery, updateParams);

    res.json({ message: 'Task submitted successfully' });
  } catch (error) {
    console.error('Task submission error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ============= ANNOUNCEMENTS ROUTES =============

// Get announcements (you can expand this to fetch from a database table)
app.get('/api/announcements', authenticateToken, async (req, res) => {
  try {
    // For now, returning static announcements
    // You can create an announcements table and fetch from there
    const announcements = [
      "Project submission deadline extended to July 5.",
      "New training materials available in the resources section.",
      "Monthly intern meet-up scheduled for July 20th.",
      "Please complete your mid-term evaluation by the end of this week."
    ];

    res.json(announcements);
  } catch (error) {
    console.error('Announcements error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ============= CERTIFICATE ROUTES =============

// Get certificate status
app.get('/api/certificate', authenticateToken, async (req, res) => {
  try {
    const internId = req.user.id;

    const certificatesResult = await db.query(
      'SELECT * FROM certificates WHERE intern_id = $1',
      [internId]
    );

    if (certificatesResult.rows.length === 0) {
      return res.status(404).json({ message: 'No certificate found' });
    }

    res.json(certificatesResult.rows[0]);
  } catch (error) {
    console.error('Certificate error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Download certificate
app.get('/api/certificate/download', authenticateToken, async (req, res) => {
  try {
    const internId = req.user.id;

    const certificatesResult = await db.query(
      'SELECT certificate_file_path FROM certificates WHERE intern_id = $1 AND status = $2',
      [internId, 'issued']
    );

    if (certificatesResult.rows.length === 0) {
      return res.status(404).json({ message: 'Certificate not available for download' });
    }

    const filePath = certificatesResult.rows[0].certificate_file_path;
    if (fs.existsSync(filePath)) {
      res.download(filePath);
    } else {
      res.status(404).json({ message: 'Certificate file not found' });
    }
  } catch (error) {
    console.error('Certificate download error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ============= PROFILE ROUTES =============

// Get intern profile
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const internId = req.user.id;

    const profileResult = await db.query(
      'SELECT employee_id, full_name, email, phone, address, start_date, end_date, status, progress, batch FROM interns WHERE id = $1',
      [internId]
    );

    if (profileResult.rows.length === 0) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    res.json(profileResult.rows[0]);
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update intern profile
app.put('/api/profile', authenticateToken, async (req, res) => {
  try {
    const internId = req.user.id;
    const { full_name, phone, address } = req.body;

    await db.query(
      'UPDATE interns SET full_name = $1, phone = $2, address = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
      [full_name, phone, address, internId]
    );

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ============= TIMELINE ROUTES =============

// Get training timeline
app.get('/api/timeline', authenticateToken, async (req, res) => {
  try {
    const internId = req.user.id;

    // Get intern's start and end dates
    const internInfoResult = await db.query(
      'SELECT start_date, end_date FROM interns WHERE id = $1',
      [internId]
    );

    if (internInfoResult.rows.length === 0) {
      return res.status(404).json({ message: 'Intern not found' });
    }

    const { start_date, end_date } = internInfoResult.rows[0];

    // Calculate timeline steps based on start and end dates
    const timelineSteps = [
      { 
        title: "Training Start", 
        date: start_date ? new Date(start_date).toLocaleDateString() : "June 1, 2025", 
        status: "completed" 
      },
      { 
        title: "Basic Tasks", 
        date: "June 15, 2025", 
        status: "completed" 
      },
      { 
        title: "Mid-review", 
        date: "July 15, 2025", 
        status: "current" 
      },
      { 
        title: "Final Project", 
        date: "August 1, 2025", 
        status: "upcoming" 
      },
      { 
        title: "Certificate Issued", 
        date: end_date ? new Date(end_date).toLocaleDateString() : "August 15, 2025", 
        status: "upcoming" 
      }
    ];

    res.json(timelineSteps);
  } catch (error) {
    console.error('Timeline error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ============= ERROR HANDLING =============

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error:', error);
  res.status(500).json({ message: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});