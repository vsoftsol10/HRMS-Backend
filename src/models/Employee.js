const { pool } = require('../config/database');

class Employee {
  // Get all employees with pagination
  static async getAll(page = 1, limit = 10, filters = {}) {
    const offset = (page - 1) * limit;
    let query = `
      SELECT 
        e.id, e.employee_code, e.first_name, e.middle_name, e.last_name,
        e.personal_email, e.phone, e.hire_date, e.status, e.employment_type,
        d.name as department_name, p.title as position_title,
        CONCAT(m.first_name, ' ', m.last_name) as manager_name
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN positions p ON e.position_id = p.id
      LEFT JOIN employees m ON e.manager_id = m.id
      WHERE 1=1
    `;

    const queryParams = [];

    // Add filters
    if (filters.department_id) {
      query += ' AND e.department_id = ?';
      queryParams.push(filters.department_id);
    }

    if (filters.status) {
      query += ' AND e.status = ?';
      queryParams.push(filters.status);
    }

    if (filters.search) {
      query += ' AND (e.first_name LIKE ? OR e.last_name LIKE ? OR e.employee_code LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    // Add pagination
    query += ' ORDER BY e.created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(limit, offset);

    const [rows] = await pool.execute(query, queryParams);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM employees e WHERE 1=1';
    const countParams = [];

    if (filters.department_id) {
      countQuery += ' AND e.department_id = ?';
      countParams.push(filters.department_id);
    }

    if (filters.status) {
      countQuery += ' AND e.status = ?';
      countParams.push(filters.status);
    }

    if (filters.search) {
      countQuery += ' AND (e.first_name LIKE ? OR e.last_name LIKE ? OR e.employee_code LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      countParams.push(searchTerm, searchTerm, searchTerm);
    }

    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;

    return {
      data: rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // Get employee by ID
  static async getById(id) {
    const query = `
      SELECT 
        e.*, d.name as department_name, p.title as position_title,
        CONCAT(m.first_name, ' ', m.last_name) as manager_name,
        c.name as company_name
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN positions p ON e.position_id = p.id
      LEFT JOIN employees m ON e.manager_id = m.id
      LEFT JOIN companies c ON e.company_id = c.id
      WHERE e.id = ?
    `;

    const [rows] = await pool.execute(query, [id]);
    return rows[0];
  }

  // Create new employee
  static async create(employeeData) {
    const {
      employee_code, first_name, middle_name, last_name, date_of_birth,
      gender, personal_email, phone, address, department_id, position_id,
      manager_id, hire_date, employment_type, work_location, status = 'active'
    } = employeeData;

    const query = `
      INSERT INTO employees (
        employee_code, first_name, middle_name, last_name, date_of_birth,
        gender, personal_email, phone, address, department_id, position_id,
        manager_id, hire_date, employment_type, work_location, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      employee_code, first_name, middle_name, last_name, date_of_birth,
      gender, personal_email, phone, address, department_id, position_id,
      manager_id, hire_date, employment_type, work_location, status
    ];

    const [result] = await pool.execute(query, values);
    return { id: result.insertId, ...employeeData };
  }

  // Update employee
  static async update(id, employeeData) {
    const fields = [];
    const values = [];

    Object.keys(employeeData).forEach(key => {
      if (employeeData[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(employeeData[key]);
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);
    const query = `UPDATE employees SET ${fields.join(', ')} WHERE id = ?`;

    const [result] = await pool.execute(query, values);
    return result.affectedRows > 0;
  }

  // Delete employee (soft delete)
  static async delete(id) {
    const query = 'UPDATE employees SET status = "inactive" WHERE id = ?';
    const [result] = await pool.execute(query, [id]);
    return result.affectedRows > 0;
  }
}

module.exports = Employee;