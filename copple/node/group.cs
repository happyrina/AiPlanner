var task1 = new Todo("1", "오늘의 중요한 업무/과제 목록 작성하기", null);
var task2 = new Todo("2", "오늘의 중요한 업무/과제 목록 작성하기", null);
var task3 = new Todo("3", "쿨 다운: 5분 스트레칭", null);
var goal1 = new Goal("1", "태국 여행 가기");
var task1_1 = new Todo("1", "교통편 알아보기", "1");
var task1_2 = new Todo("2", "항공권 예약", "1");
var task1_3 = new Todo("3", "교통편 알아보기", "1");
var goal2 = new Goal("2", "프랑스 여행 가기");

var results = new List<Result>
{
    new Result(new Goal(null, "없음"), new List<Todo> { task1, task2, task3 }),
    new Result(goal1, new List<Todo> { task1_1, task1_2, task1_3 }),
};

var tasks = new List<Todo>
{
    task1,
    task2,
    task3,
    task1_1,
    task1_2,
    task1_3,
};
var goalIds = tasks.Select(x => x.GoalId).Distinct().ToList();
var goals = new List<Goal>()
{
    goal1,
    goal2
};
var query = goals.Where(x => goalIds.Contains(x.Id)).ToList();
var grouped = tasks
    .GroupBy(x => x.GoalId)
    .Select(x => new Result(query.FirstOrDefault(y => y.Id == x.Key), x.ToList()))
    .ToList();