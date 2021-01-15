"use strict";

const {
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
} = require("../expressError");
const db = require("../db.js");
const User = require("./user.js");
const {
  commonBeforeAll,
  commonBeforeEach,
  commonAfterEach,
  commonAfterAll,
  testJobIds
} = require("./_testCommon");

beforeAll(commonBeforeAll);
beforeEach(commonBeforeEach);
afterEach(commonAfterEach);
afterAll(commonAfterAll);


/************************************** authenticate */

describe("authenticate", function () {
  test("works", async function () {
    const user = await User.authenticate("u1", "password1");
    expect(user).toEqual({
      username: "u1",
      firstName: "U1F",
      lastName: "U1L",
      email: "u1@email.com",
      isAdmin: false,
    });
  });

  test("unauth if no such user", async function () {
    try {
      await User.authenticate("nope", "password");
      fail();
    } catch (err) {
      expect(err instanceof UnauthorizedError).toBeTruthy();
    }
  });

  test("unauth if wrong password", async function () {
    try {
      await User.authenticate("c1", "wrong");
      fail();
    } catch (err) {
      expect(err instanceof UnauthorizedError).toBeTruthy();
    }
  });
});

/************************************** register */

describe("register", function () {
  const newUser = {
    username: "new",
    firstName: "Test",
    lastName: "Tester",
    email: "test@test.com",
    isAdmin: false,
  };

  test("works", async function () {
    let user = await User.register({
      ...newUser,
      password: "password",
    });
    expect(user).toEqual(newUser);
    const found = await db.query("SELECT * FROM users WHERE username = 'new'");
    expect(found.rows.length).toEqual(1);
    expect(found.rows[0].is_admin).toEqual(false);
    expect(found.rows[0].password.startsWith("$2b$")).toEqual(true);
  });

  test("works: adds admin", async function () {
    let user = await User.register({
      ...newUser,
      password: "password",
      isAdmin: true,
    });
    expect(user).toEqual({ ...newUser, isAdmin: true });
    const found = await db.query("SELECT * FROM users WHERE username = 'new'");
    expect(found.rows.length).toEqual(1);
    expect(found.rows[0].is_admin).toEqual(true);
    expect(found.rows[0].password.startsWith("$2b$")).toEqual(true);
  });

  test("bad request with dup data", async function () {
    try {
      await User.register({
        ...newUser,
        password: "password",
      });
      await User.register({
        ...newUser,
        password: "password",
      });
      fail();
    } catch (err) {
      expect(err instanceof BadRequestError).toBeTruthy();
    }
  });
});

/************************************** findAll */

describe("findAll", function () {
  test("works", async function () {
    const users = await User.findAll();
    expect(users).toEqual([
      {
        username: "u1",
        firstName: "U1F",
        lastName: "U1L",
        email: "u1@email.com",
        isAdmin: false,
        jobs: [testJobIds[0], testJobIds[1]],
      },
      {
        username: "u2",
        firstName: "U2F",
        lastName: "U2L",
        email: "u2@email.com",
        isAdmin: false,
        jobs: [],
      },
    ]);
  });
});

/************************************** get */

describe("get", function () {
  test("works", async function () {
    let user = await User.get("u1");
    expect(user).toEqual({
      username: "u1",
      firstName: "U1F",
      lastName: "U1L",
      email: "u1@email.com",
      isAdmin: false,
      jobs: [testJobIds[0], testJobIds[1]],
    });
  });

  test("not found if no such user", async function () {
    try {
      await User.get("nope");
      fail();
    } catch (err) {
      expect(err instanceof NotFoundError).toBeTruthy();
    }
  });
});

/************************************** update */

describe("update", function () {
  const updateData = {
    firstName: "NewF",
    lastName: "NewF",
    email: "new@email.com",
    isAdmin: true,
  };

  test("works", async function () {
    let job = await User.update("u1", updateData);
    expect(job).toEqual({
      username: "u1",
      ...updateData,
    });
  });

  test("works: set password", async function () {
    let job = await User.update("u1", {
      password: "new",
    });
    expect(job).toEqual({
      username: "u1",
      firstName: "U1F",
      lastName: "U1L",
      email: "u1@email.com",
      isAdmin: false,
    });
    const found = await db.query("SELECT * FROM users WHERE username = 'u1'");
    expect(found.rows.length).toEqual(1);
    expect(found.rows[0].password.startsWith("$2b$")).toEqual(true);
  });

  test("not found if no such user", async function () {
    try {
      await User.update("nope", {
        firstName: "test",
      });
      fail();
    } catch (err) {
      expect(err instanceof NotFoundError).toBeTruthy();
    }
  });

  test("bad request if no data", async function () {
    expect.assertions(1);
    try {
      await User.update("c1", {});
      fail();
    } catch (err) {
      expect(err instanceof BadRequestError).toBeTruthy();
    }
  });
});

/************************************** remove */

describe("remove", function () {
  test("works", async function () {
    await User.remove("u1");
    const res = await db.query(
      "SELECT * FROM users WHERE username='u1'");
    expect(res.rows.length).toEqual(0);
  });

  test("not found if no such user", async function () {
    try {
      await User.remove("nope");
      fail();
    } catch (err) {
      expect(err instanceof NotFoundError).toBeTruthy();
    }
  });
});


/************************************** applyForJob */

describe("applyForJob", function () {
  test("works", async function () {
    await User.applyForJob("u2", testJobIds[0]);
    const res = await db.query(
      `SELECT username, job_id AS "jobId"
          FROM applications 
          WHERE username='u2' AND job_id = $1`,
      [testJobIds[0]]);
    expect(res.rows[0]).toEqual({
      username: 'u2',
      jobId: testJobIds[0]
    });
  });

  // TODO: expect(err.msg).contains("Some error message")
  test("not found if no such user", async function () {
    try {
      await User.applyForJob("nope", testJobIds[0]);
      fail();
    } catch (err) {
      expect(err instanceof NotFoundError).toBeTruthy();
    }
  });

  test("not found if no such job", async function () {
    try {
      await User.applyForJob("u1", 0);
      fail();
    } catch (err) {
      expect(err instanceof NotFoundError).toBeTruthy();
    }
  });

  test("bad request if user already applied to job", async function () {
    try {
      await User.applyForJob("u1", testJobIds[0]);
      fail();
    } catch (err) {
      expect(err instanceof BadRequestError).toBeTruthy();
    }
  });
});

<<<<<<< HEAD
/************************************** updateAppStatus */

describe("updateAppStatus", function () {
  test("works", async function () {
    await User.updateAppStatus("u1", testJobIds[0], 'accepted');
    const res = await db.query(
      `SELECT username, job_id AS "jobId", state
          FROM applications 
          WHERE username='u1' AND job_id = $1`,
      [testJobIds[0]]);
    expect(res.rows[0]).toEqual({
      username: 'u1',
      jobId: testJobIds[0],
      state: "accepted"
    });
  });

  // TODO: expect(err.msg).contains("Some error message")
  test("not found if no such user", async function () {
    try {
      await User.updateAppStatus("nope", testJobIds[0], 'accepted');
      fail();
    } catch (err) {
      expect(err instanceof NotFoundError).toBeTruthy();
    }
  });

  test("not found if no such job", async function () {
    try {
      await User.updateAppStatus("u1", 0, 'accepted');
      fail();
    } catch (err) {
      expect(err instanceof NotFoundError).toBeTruthy();
    }
  });

  test("bad request if state is not ‘interested’, ‘applied’, ‘accepted’, ‘rejected’", async function () {
    try {
      await User.updateAppStatus("u1", testJobIds[0], 'nope');
      fail();
    } catch (err) {
      expect(err instanceof BadRequestError).toBeTruthy();
    }
  });

  test("not found if application doesn't exist", async function () {
    try {
      await User.updateAppStatus("u2", testJobIds[0], 'accepted');
      fail();
    } catch (err) {
      expect(err instanceof NotFoundError).toBeTruthy();
    }
  });
});
=======
/************************************** _generateRandomPassword */

describe("_generateRandomPassword", function () {
  test("works for different lengths", async function () {
    let randomLength = Math.round(Math.random() * (10));
    let password = User._generateRandomPassword(randomLength);
    
    expect(password.length).toEqual(randomLength);
    expect(password).toEqual(expect.any(String));

    let randomLength2 = Math.round(Math.random() * (10));
    let password2 = User._generateRandomPassword(randomLength2);
    
    expect(password2.length).toEqual(randomLength2);
    expect(password2).toEqual(expect.any(String));
  });

  test("works for default length", async function () {
    let password = User._generateRandomPassword();
    
    expect(password.length).toEqual(10);
    expect(password).toEqual(expect.any(String));
  });
});
>>>>>>> 5dead9c8b4c3a8d6d1e650d61ea10f674b5fdd81
