const PayrollService = require('../../services/payslip/payrollService');

class PayrollController {
  static async getAllPayrolls(req, res) {
    try {
      const payrolls = await PayrollService.getAllPayrolls();
      res.json(payrolls);
    } catch (error) {
      console.error("Error fetching payrolls:", error);
      res.status(500).json({ 
        message: "Error fetching payrolls", 
        error: error.message 
      });
    }
  }

  static async getPayrollById(req, res) {
    try {
      const id = parseInt(req.params.id);
      const payroll = await PayrollService.getPayrollById(id);
      
      if (!payroll) {
        return res.status(404).json({ message: "Payroll not found" });
      }
      
      res.json(payroll);
    } catch (error) {
      console.error("Error fetching payroll:", error);
      res.status(500).json({ 
        message: "Error fetching payroll", 
        error: error.message 
      });
    }
  }

  static async createPayroll(req, res) {
    try {
      const payrollData = req.body;
      const result = await PayrollService.createPayroll(payrollData);
      
      res.status(201).json({
        message: "Payroll created successfully",
        id: result.id,
        payroll: result.payroll
      });
    } catch (error) {
      console.error("Error creating payroll:", error);
      if (error.code === "23505") {
        res.status(400).json({ message: "Employee ID already exists" });
      } else {
        res.status(500).json({ 
          message: "Error creating payroll", 
          error: error.message 
        });
      }
    }
  }

  static async updatePayroll(req, res) {
    try {
      const id = parseInt(req.params.id);
      const payrollData = req.body;
      
      const result = await PayrollService.updatePayroll(id, payrollData);
      
      if (!result) {
        return res.status(404).json({ message: "Payroll not found" });
      }
      
      res.json({
        message: "Payroll updated successfully",
        payroll: result
      });
    } catch (error) {
      console.error("Error updating payroll:", error);
      res.status(500).json({ 
        message: "Error updating payroll", 
        error: error.message 
      });
    }
  }

  static async deletePayroll(req, res) {
    try {
      const id = parseInt(req.params.id);
      const deleted = await PayrollService.deletePayroll(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Payroll not found" });
      }
      
      res.status(200).json({ message: "Payroll deleted successfully" });
    } catch (error) {
      console.error("Error deleting payroll:", error);
      res.status(500).json({ 
        message: "Error deleting payroll", 
        error: error.message 
      });
    }
  }
}

module.exports = PayrollController;