const pool = require('../../config/database');

// Get all tasks
const getTasks = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, i.full_name as assigned_to_name 
      FROM tasks t 
      LEFT JOIN interns i ON t.assigned_to = i.id 
      ORDER BY t.created_at DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create new task
const createTask = async (req, res) => {
  try {
    const { title, description, assigned_to, due_date } = req.body;
    
    const result = await pool.query(
      'INSERT INTO tasks (title, description, assigned_to, assigned_by, due_date) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [title, description, assigned_to, req.admin.id, due_date]
    );

    // Create notification for intern
    await pool.query(
      'INSERT INTO notifications (intern_id, title, message, type) VALUES ($1, $2, $3, $4)',
      [assigned_to, 'New Task Assigned', `You have been assigned a new task: ${title}`, 'info']
    );

    res.json({ id: result.rows[0].id, message: 'Task created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update task
const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, feedback, grade } = req.body;
    
    await pool.query(
      'UPDATE tasks SET title = $1, description = $2, status = $3, feedback = $4, grade = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6',
      [title, description, status, feedback, grade, id]
    );

    res.json({ message: 'Task updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getTasks,
  createTask,
  updateTask
};