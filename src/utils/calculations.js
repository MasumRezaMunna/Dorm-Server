/**
 * Utility functions for dorm expense and billing calculations.
 */

export const calculateTotalGroceryCost = (expenses = []) =>
  expenses
    .filter(e => e.expenseType === 'Grocery')
    .reduce((sum, e) => sum + (e.amount || 0), 0);

export const calculateTotalCommonCost = (expenses = []) =>
  expenses
    .filter(e => e.expenseType === 'Common')
    .reduce((sum, e) => sum + (e.amount || 0), 0);

export const calculateTotalExpense = (groceryCost = 0, commonCost = 0) => groceryCost + commonCost;

export const calculateMealRate = (groceryCost = 0, totalMeals = 0) => {
  if (totalMeals <= 0) return 0;
  return roundTwo(groceryCost / totalMeals);
};

export const calculateCommonCostPerMember = (commonCost = 0, activeMembersCount = 0) => {
  if (activeMembersCount <= 0) return 0;
  return roundTwo(commonCost / activeMembersCount);
};

export const calculateMemberBill = (
  memberMeals = 0,
  mealRate = 0,
  commonCostPerMember = 0,
  rent = 0,
  otherCharges = 0
) => {
  const foodCost = roundTwo(memberMeals * mealRate);
  const commonCost = commonCostPerMember;
  const totalAmount = roundTwo(rent + foodCost + commonCost + otherCharges);

  return { foodCost, commonCost, rent, otherCharges, totalAmount };
};

// Helper to round to two decimal places
export const roundTwo = (num) => Math.round(Number(num) * 100) / 100;
