import { GradeMethod, ReviewPermission } from "../constants";

export type TestConfig = {
  id: string;
  name: string;
  description: string;
  force_fullscreen: string;
  review_permission: ReviewPermission;
  show_point_weight: boolean;
  review_point_weight: boolean;
  allow_early_continue: boolean;
  results_available: boolean;
  grade_method: GradeMethod;
  passing_score: number;
  tickets: string[];
}

export type Module = {
  id: number;
  number: number;
  name: string;
  test_id: string;
  reference_image: string;
  time: number;
  questions: Question[];
}

export type Question = {
  number: number;
  question: string;
  context?: string;
  points: number;
  choices: string[];
  answer: number;
  explanation?: string;
  module_int: number;
}

export type Score = {
  score: string,
  points_earned: number,
  total_possible_points: number,
  percentage: number,
  total_questions: number,
  total_wrong: number,
  wrong_answer_indices: number[]
}