const express = require("express");
const materialController = require("../controllers/materialController");
const { isLoggedIn, isSubscribed } = require("../middleware/auth");
const User = require("../models/User");
const Branch = require("../models/Branch");
const Department = require("../models/Department");
const Semester = require("../models/Semester");
const Subject = require("../models/Subject");
const Material = require("../models/Material");

const router = express.Router();

router.get("/materials", isLoggedIn, isSubscribed, async (req, res) => {
  const usr = await req.user.populate(
    "cohort.department cohort.branch cohort.semester",
  );

  const cohort = usr.cohort || {};

  const departments = await Department.find().sort({ name: 1 });

  const branches = await Branch.find().sort({ name: 1 });
  const semesters = await Semester.find().sort({ number: 1 });
  const subjects = await Subject.find().sort({ name: 1 });

  const userDepartment = await Department.findById(cohort.department);
  const userBranch = await Branch.findById(cohort.branch);
  const userSemester = await Semester.findById(cohort.semester);
  res.render("student/materials", {
    branches,
    semesters,
    subjects,
    cohort,
    departments,
    userDepartment,
    userBranch,
    userSemester,
  });
});

router.get("/browse/:subjectId", isLoggedIn, isSubscribed, async (req, res) => {
  const materials = await Material.find({ subject: req.params.subjectId })
    .populate("subject branch semester")
    .sort({ uploadedAt: -1 });

  res.render("student/browse", {
    materials,
    subjects: [],
    cohort: {},
    filters: {},
  });
});

router.get("/materials/:id/read", isLoggedIn, isSubscribed, async (req, res) => {
  const material = await Material.findById(req.params.id).populate(
    "subject branch semester",
  );
  const title = material.title;

  const usr = await req.user.populate(
    "cohort.department cohort.branch cohort.semester",
  );

  const cohort = usr.cohort || {};

  res.render(
    `content/${cohort.department.name}/${cohort.branch.name}/${cohort.semester.name}/${material.subject.name}/${title}.ejs`,
  );
});

// router.get("/materials", isLoggedIn, materialController.listMaterials);

// router.get("/browse", isLoggedIn, materialController.browseMaterials);

router.post("/cohort", isLoggedIn, isSubscribed, materialController.setCohort);
router.get(
  "/api/departments/:departmentId/branches",
  isLoggedIn,
  isSubscribed,
  materialController.getBranches,
);
router.get(
  "/api/branches/:branchId/semesters",
  isLoggedIn,
  isSubscribed,
  materialController.getSemesters,
);
// router.get(
//   "/materials/:id/read",
//   isLoggedIn,
//   isSubscribed,
//   materialController.viewerPage,
// );
router.get(
  "/view/:id",
  isLoggedIn,
  isSubscribed,
  materialController.secureStream,
);
router.post(
  "/materials/:id/favorite",
  isLoggedIn,
  isSubscribed,
  materialController.toggleFavorite,
);
router.get("/favorites", isLoggedIn, isSubscribed, materialController.favoritesPage);
router.post("/activity", isLoggedIn, isSubscribed, materialController.trackActivity);

module.exports = router;
