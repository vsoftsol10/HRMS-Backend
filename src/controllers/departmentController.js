// GET API - Fetch departments for dropdown
app.get("/api/departments", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name FROM departments ORDER BY name"
    );
    res.json(result.rows); // Use result.rows for PostgreSQL
  } catch (error) {
    console.error("Error fetching departments:", error);
    res
      .status(500)
      .json({ message: "Error fetching departments", error: error.message });
  }
});