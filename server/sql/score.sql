WITH question_points AS (
  -- Get all questions and their points for the test
  SELECT 
    m.test_id,
    m.id as module_id,
    m.number as module_number,
    q.number,
    q.points,
    q.answer,
    ROW_NUMBER() OVER (
      PARTITION BY m.test_id 
      ORDER BY m.number, q.number
    ) - 1 as absolute_question_index
  FROM module m
  JOIN question q ON q.module_id = m.id
),
question_answers AS (
  -- Calculate individual question results with correct indexing
  SELECT 
    a.ticket,
    a.test_id,
    qp.module_id,
    qp.module_number,
    qp.number as question_number,
    qp.absolute_question_index as array_index,
    a.answers as full_answers_array,
    a.answers[qp.absolute_question_index + 1] as given_answer,
    qp.answer as correct_answer,
    qp.points
  FROM answer a
  JOIN test t ON t.id = a.test_id
  JOIN question_points qp ON qp.test_id = a.test_id
  WHERE a.finished = true
),
answer_results AS (
  -- Calculate aggregated results including wrong answers
  SELECT 
    qa.ticket,
    qa.test_id,
    t.grade_method,
    t.passing_score,
    SUM(CASE WHEN qa.given_answer = qa.correct_answer THEN qa.points ELSE 0 END) as points_earned,
    SUM(qa.points) as total_possible_points,
    COUNT(*) as total_questions,
    COUNT(*) FILTER (WHERE qa.given_answer != qa.correct_answer) as total_wrong,
    COALESCE(
      ARRAY_AGG(
        qa.array_index 
        ORDER BY qa.module_number, qa.question_number
      ) FILTER (WHERE qa.given_answer != qa.correct_answer),
      ARRAY[]::integer[]
    ) as wrong_answer_indices,
    ROUND(
      (SUM(CASE WHEN qa.given_answer = qa.correct_answer THEN qa.points ELSE 0 END) * 100.0 / 
      SUM(qa.points))::numeric, 
      2
    ) as percentage
  FROM question_answers qa
  JOIN test t ON t.id = qa.test_id
  GROUP BY qa.ticket, qa.test_id, t.grade_method, t.passing_score
)
SELECT
  points_earned,
  total_possible_points,
  percentage,
  total_questions::numeric,
  total_wrong::numeric,
  wrong_answer_indices::numeric[],
  CASE 
    WHEN grade_method = 'LETTER' THEN
      CASE 
        WHEN percentage >= 93 THEN 'A'
        WHEN percentage >= 90 THEN 'A-'
        WHEN percentage >= 87 THEN 'B+'
        WHEN percentage >= 83 THEN 'B'
        WHEN percentage >= 80 THEN 'B-'
        WHEN percentage >= 77 THEN 'C+'
        WHEN percentage >= 73 THEN 'C'
        WHEN percentage >= 70 THEN 'C-'
        WHEN percentage >= 67 THEN 'D+'
        WHEN percentage >= 63 THEN 'D'
        WHEN percentage >= 60 THEN 'D-'
        ELSE 'F'
      END
    WHEN grade_method = 'PASS_FAIL' THEN
      CASE 
        WHEN percentage >= passing_score THEN 'Pass'
        ELSE 'Fail'
      END
    ELSE points_earned::text
  END as score
FROM answer_results
WHERE ticket = $1;