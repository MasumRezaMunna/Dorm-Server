/**
 * Utility functions for dorm expense and billing calculations.
 */

export const calculateTotalGroceryCost = (expenses = []) => {
  return expenses
    .filter(e => e.expenseType === 'Grocery')
    .reduce((sum, e) => sum + (e.amount || 0), 0);
};

export const calculateTotalCommonCost = (expenses = []) => {
  return expenses
    .filter(e => e.expenseType === 'Common')
    .reduce((sum, e) => sum + (e.amount || 0), 0);
};

export const calculateTotalExpense = (groceryCost = 0, commonCost = 0) => {
  return groceryCost + commonCost;
};

export const calculateMealRate = (groceryCost = 0, totalMeals = 0) => {
  if (totalMeals <= 0) return 0;
  // Round to 2 decimal places
  return Math.round((groceryCost / totalMeals) * 100) / 100;
};

export const calculateCommonCostPerMember = (commonCost = 0, activeMembersCount = 0) => {
  if (activeMembersCount <= 0) return 0;
  // Round to 2 decimal places
  return Math.round((commonCost / activeMembersCount) * 100) / 100;
};

export const calculateMemberBill = (memberMeals = 0, mealRate = 0, commonCostPerMember = 0, rent = 0, otherCharges = 0) => {
  const foodCost = Math.round(memberMeals * mealRate * 100) / 100;
  const commonCost = commonCostPerMember;
  const totalAmount = rent + foodCost + commonCost + otherCharges;
  
  return {
    foodCost,
    commonCost,
    rent,
    otherCharges,
    totalAmount
  };
};
