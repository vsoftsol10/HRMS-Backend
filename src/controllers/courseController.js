//Courses API
app.get("/api/courses", async (req, res) => {
  try {
    // Get all active courses
    const coursesQuery = `
      SELECT id, title, icon, description, duration, student_count, level, created_at, updated_at
      FROM courses 
      WHERE is_active = TRUE
      ORDER BY id ASC
    `;

    const coursesResult = await db.query(coursesQuery);
    const courses = coursesResult.rows;

    for (let course of courses) {
      // Get platforms
      const platformsQuery = `
        SELECT p.name 
        FROM platforms p
        JOIN course_platforms cp ON p.id = cp.platform_id
        WHERE cp.course_id = $1
      `;
      const platformsResult = await db.query(platformsQuery, [course.id]);
      course.platforms = platformsResult.rows.map((p) => p.name);

      // Get topics
      const topicsQuery = `
        SELECT topic_name 
        FROM course_topics 
        WHERE course_id = $1
        ORDER BY topic_order ASC
      `;
      const topicsResult = await db.query(topicsQuery, [course.id]);
      course.topics = topicsResult.rows.map((t) => t.topic_name);

      // Get features
      const featuresQuery = `
        SELECT feature_name 
        FROM course_features 
        WHERE course_id = $1
        ORDER BY feature_order ASC
      `;
      const featuresResult = await db.query(featuresQuery, [course.id]);
      course.features = featuresResult.rows.map((f) => f.feature_name);

      // Rename student_count to students
      course.students = course.student_count;
      delete course.student_count;
    }

    res.json({
      success: true,
      data: courses,
    });
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch courses",
      error: error.message,
    });
  }
});

// GET single course by ID
app.get("/api/courses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const connection = req.db;

    // Get course details
    const courseQuery = `
      SELECT id, title, icon, description, duration, student_count, level, created_at, updated_at
      FROM courses 
      WHERE id = ? AND is_active = TRUE
    `;

    const [courseResult] = await connection.execute(courseQuery, [id]);

    if (courseResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    const course = courseResult[0];

    // Get platforms
    const platformsQuery = `
      SELECT p.name 
      FROM platforms p
      JOIN course_platforms cp ON p.id = cp.platform_id
      WHERE cp.course_id = ?
    `;
    const [platforms] = await connection.execute(platformsQuery, [id]);
    course.platforms = platforms.map((p) => p.name);

    // Get topics
    const topicsQuery = `
      SELECT topic_name 
      FROM course_topics 
      WHERE course_id = ?
      ORDER BY topic_order ASC
    `;
    const [topics] = await connection.execute(topicsQuery, [id]);
    course.topics = topics.map((t) => t.topic_name);

    // Get features
    const featuresQuery = `
      SELECT feature_name 
      FROM course_features 
      WHERE course_id = ?
      ORDER BY feature_order ASC
    `;
    const [features] = await connection.execute(featuresQuery, [id]);
    course.features = features.map((f) => f.feature_name);

    // Rename student_count to students for frontend compatibility
    course.students = course.student_count;
    delete course.student_count;

    res.json({
      success: true,
      data: course,
    });
  } catch (error) {
    console.error("Error fetching course:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch course",
      error: error.message,
    });
  }
});

// POST create new course
app.post("/api/courses", async (req, res) => {
  try {
    const {
      title,
      icon,
      description,
      duration,
      student_count,
      level,
      platforms,
      topics,
      features,
    } = req.body;

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Insert course
      const courseQuery = `
        INSERT INTO courses (title, icon, description, duration, student_count, level)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      const [courseResult] = await connection.execute(courseQuery, [
        title,
        icon,
        description,
        duration,
        student_count,
        level,
      ]);
      const courseId = courseResult.insertId;

      // Insert platforms
      if (platforms && platforms.length > 0) {
        for (let platformName of platforms) {
          // Insert platform if it doesn't exist
          const insertPlatformQuery = `
            INSERT IGNORE INTO platforms (name) VALUES (?)
          `;
          await connection.execute(insertPlatformQuery, [platformName]);

          // Get platform ID
          const getPlatformQuery = `SELECT id FROM platforms WHERE name = ?`;
          const [platformResult] = await connection.execute(getPlatformQuery, [
            platformName,
          ]);
          const platformId = platformResult[0].id;

          // Link course to platform
          const linkQuery = `
            INSERT INTO course_platforms (course_id, platform_id) VALUES (?, ?)
          `;
          await connection.execute(linkQuery, [courseId, platformId]);
        }
      }

      // Insert topics
      if (topics && topics.length > 0) {
        for (let i = 0; i < topics.length; i++) {
          const topicQuery = `
            INSERT INTO course_topics (course_id, topic_name, topic_order) VALUES (?, ?, ?)
          `;
          await connection.execute(topicQuery, [courseId, topics[i], i + 1]);
        }
      }

      // Insert features
      if (features && features.length > 0) {
        for (let i = 0; i < features.length; i++) {
          const featureQuery = `
            INSERT INTO course_features (course_id, feature_name, feature_order) VALUES (?, ?, ?)
          `;
          await connection.execute(featureQuery, [
            courseId,
            features[i],
            i + 1,
          ]);
        }
      }

      await connection.commit();
      connection.release();

      res.status(201).json({
        success: true,
        message: "Course created successfully",
        data: { id: courseId },
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error("Error creating course:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create course",
      error: error.message,
    });
  }
});

// PUT update course
app.put("/api/courses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      icon,
      description,
      duration,
      student_count,
      level,
      platforms,
      topics,
      features,
    } = req.body;

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Update course
      const courseQuery = `
        UPDATE courses 
        SET title = ?, icon = ?, description = ?, duration = ?, student_count = ?, level = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      await connection.execute(courseQuery, [
        title,
        icon,
        description,
        duration,
        student_count,
        level,
        id,
      ]);

      // Delete existing relationships
      await connection.execute(
        "DELETE FROM course_platforms WHERE course_id = ?",
        [id]
      );
      await connection.execute(
        "DELETE FROM course_topics WHERE course_id = ?",
        [id]
      );
      await connection.execute(
        "DELETE FROM course_features WHERE course_id = ?",
        [id]
      );

      // Re-insert platforms
      if (platforms && platforms.length > 0) {
        for (let platformName of platforms) {
          const insertPlatformQuery = `INSERT IGNORE INTO platforms (name) VALUES (?)`;
          await connection.execute(insertPlatformQuery, [platformName]);

          const getPlatformQuery = `SELECT id FROM platforms WHERE name = ?`;
          const [platformResult] = await connection.execute(getPlatformQuery, [
            platformName,
          ]);
          const platformId = platformResult[0].id;

          const linkQuery = `INSERT INTO course_platforms (course_id, platform_id) VALUES (?, ?)`;
          await connection.execute(linkQuery, [id, platformId]);
        }
      }

      // Re-insert topics
      if (topics && topics.length > 0) {
        for (let i = 0; i < topics.length; i++) {
          const topicQuery = `INSERT INTO course_topics (course_id, topic_name, topic_order) VALUES (?, ?, ?)`;
          await connection.execute(topicQuery, [id, topics[i], i + 1]);
        }
      }

      // Re-insert features
      if (features && features.length > 0) {
        for (let i = 0; i < features.length; i++) {
          const featureQuery = `INSERT INTO course_features (course_id, feature_name, feature_order) VALUES (?, ?, ?)`;
          await connection.execute(featureQuery, [id, features[i], i + 1]);
        }
      }

      await connection.commit();
      connection.release();

      res.json({
        success: true,
        message: "Course updated successfully",
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error("Error updating course:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update course",
      error: error.message,
    });
  }
});

// DELETE course (soft delete)
app.delete("/api/courses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const connection = req.db;

    const deleteQuery = `
      UPDATE courses 
      SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const [result] = await connection.execute(deleteQuery, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    res.json({
      success: true,
      message: "Course deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting course:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete course",
      error: error.message,
    });
  }
});