
const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');
const { validationResult } = require('express-validator');

class PayrollController {
  // Get all payroll records
  static async getAllPayrolls(req, res) {
    try {
      const options = {
        page: req.query.page || 1,
        limit: req.query.limit || 10,
        employee_id: req.query.employee_id,
        status: req.query.status,
        pay_period_start: req.query.pay_period_start,
        pay_period_end: req.query.pay_period_end
      };

      const result = await Payroll.findAll(options);

      res.status(200).json({
        success: true,
        message: 'Payroll records retrieved successfully',
        data: result.payrolls,
        pagination: result.pagination
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error retrieving payroll records',
        error: error.message
      });
    }
  }

  // Get payroll by ID
  static async getPayrollById(req, res) {
    try {
      const { id } = req.params;
      const payroll = await Payroll.findById(id);

      if (!payroll) {
        return res.status(404).json({
          success: false,
          message: 'Payroll record not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Payroll record retrieved successfully',
        data: payroll
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error retrieving payroll record',
        error: error.message
      });
    }
  }

  // Create new payroll record
  static async createPayroll(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      // Verify employee exists
      const employee = await Employee.findById(req.body.employee_id);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }

      // Check if payroll already exists for the period
      const existingPayroll = await Payroll.findAll({
        employee_id: req.body.employee_id,
        pay_period_start: req.body.pay_period_start,
        pay_period_end: req.body.pay_period_end
      });

      if (existingPayroll.payrolls.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Payroll already exists for this employee and period'
        });
      }

      const payroll = await Payroll.create(req.body);

      res.status(201).json({
        success: true,
        message: 'Payroll record created successfully',
        data: payroll
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error creating payroll record',
        error: error.message
      });
    }
  }

  // Update payroll record
  static async updatePayroll(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const payroll = await Payroll.updateById(id, req.body);

      if (!payroll) {
        return res.status(404).json({
          success: false,
          message: 'Payroll record not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Payroll record updated successfully',
        data: payroll
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating payroll record',
        error: error.message
      });
    }
  }

  // Delete payroll record
  static async deletePayroll(req, res) {
    try {
      const { id } = req.params;
      const deleted = await Payroll.deleteById(id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Payroll record not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Payroll record deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error deleting payroll record',
        error: error.message
      });
    }
  }

  // Update payment status
  static async updatePaymentStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, payment_date } = req.body;

      if (!['pending', 'paid', 'cancelled'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid payment status. Must be: pending, paid, or cancelled'
        });
      }

      const payroll = await Payroll.updatePaymentStatus(id, status, payment_date);

      if (!payroll) {
        return res.status(404).json({
          success: false,
          message: 'Payroll record not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Payment status updated successfully',
        data: payroll
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating payment status',
        error: error.message
      });
    }
  }

  // Get employee payroll summary
  static async getEmployeePayrollSummary(req, res) {
    try {
      const { employeeId } = req.params;
      const { year = new Date().getFullYear() } = req.query;

      // Verify employee exists
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }

      const summary = await Payroll.getEmployeePayrollSummary(employeeId, year);

      res.status(200).json({
        success: true,
        message: 'Employee payroll summary retrieved successfully',
        data: {
          employee: {
            id: employee.id,
            name: `${employee.first_name} ${employee.last_name}`,
            employee_id: employee.employee_id
          },
          year: parseInt(year),
          summary
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error retrieving payroll summary',
        error: error.message
      });
    }
  }

  // Generate bulk payroll for multiple employees
  static async generateBulkPayroll(req, res) {
    try {
      const { 
        employee_ids, 
        pay_period_start, 
        pay_period_end, 
        default_overtime_rate = 0 
      } = req.body;

      if (!employee_ids || !Array.isArray(employee_ids) || employee_ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Employee IDs array is required'
        });
      }

      const results = [];
      const errors = [];

      for (const employeeId of employee_ids) {
        try {
          // Get employee details
          const employee = await Employee.findById(employeeId);
          if (!employee) {
            errors.push(`Employee with ID ${employeeId} not found`);
            continue;
          }

          // Check if payroll already exists
          const existingPayroll = await Payroll.findAll({
            employee_id: employeeId,
            pay_period_start,
            pay_period_end
          });

          if (existingPayroll.payrolls.length > 0) {
            errors.push(`Payroll already exists for employee ${employee.first_name} ${employee.last_name}`);
            continue;
          }

          // Create payroll record with employee's basic salary
          const payrollData = {
            employee_id: employeeId,
            pay_period_start,
            pay_period_end,
            basic_salary: employee.salary || 0,
            allowances: 0,
            overtime_hours: 0,
            overtime_rate: default_overtime_rate,
            tax_deduction: 0,
            insurance_deduction: 0,
            other_deductions: 0
          };

          const payroll = await Payroll.create(payrollData);
          results.push(payroll);

        } catch (error) {
          errors.push(`Error processing employee ID ${employeeId}: ${error.message}`);
        }
      }

      res.status(200).json({
        success: true,
        message: `Bulk payroll generation completed. Created ${results.length} records.`,
        data: {
          created: results,
          errors: errors,
          summary: {
            total_requested: employee_ids.length,
            created: results.length,
            failed: errors.length
          }
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error generating bulk payroll',
        error: error.message
      });
    }
  }

  // Get payroll statistics
  static async getPayrollStatistics(req, res) {
    try {
      const { year = new Date().getFullYear(), month } = req.query;
      
      // This is a simplified version - you might want to create specific queries
      const options = {
        limit: 1000, // Get more records for statistics
      };

      if (month) {
        options.pay_period_start = `${year}-${month.padStart(2, '0')}-01`;
        options.pay_period_end = `${year}-${month.padStart(2, '0')}-31`;
      }

      const result = await Payroll.findAll(options);
      const payrolls = result.payrolls;

      const statistics = {
        total_payrolls: payrolls.length,
        total_gross_salary: payrolls.reduce((sum, p) => sum + parseFloat(p.gross_salary), 0),
        total_deductions: payrolls.reduce((sum, p) => sum + parseFloat(p.total_deductions), 0),
        total_net_salary: payrolls.reduce((sum, p) => sum + parseFloat(p.net_salary), 0),
        average_salary: payrolls.length > 0 ? 
          payrolls.reduce((sum, p) => sum + parseFloat(p.net_salary), 0) / payrolls.length : 0,
        payment_status_breakdown: {
          pending: payrolls.filter(p => p.payment_status === 'pending').length,
          paid: payrolls.filter(p => p.payment_status === 'paid').length,
          cancelled: payrolls.filter(p => p.payment_status === 'cancelled').length
        }
      };

      res.status(200).json({
        success: true,
        message: 'Payroll statistics retrieved successfully',
        data: statistics
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error retrieving payroll statistics',
        error: error.message
      });
    }
  }
}

module.exports = PayrollController;