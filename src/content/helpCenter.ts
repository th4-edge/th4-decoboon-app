export interface HelpQuickStep {
  title: string
  description: string
  result: string
  actionLabel?: string
  actionPath?: string
}

export interface HelpQuickStart {
  title: string
  subtitle: string
  steps: HelpQuickStep[]
}

export interface HelpTopic {
  id: string
  category: string
  title: string
  summary: string
  symptoms: string[]
  reason: string
  actions: string[]
  actionLabel?: string
  actionPath?: string
  roles?: string[]
}

export const HELP_QUICK_STARTS: Record<string, HelpQuickStart> = {
  boss: {
    title: '老板第一次使用',
    subtitle: '先建立报价基础，再用一个真实客户跑通签约和项目。',
    steps: [
      { title: '建立报价项目库', description: '导入或维护材料、施工和套餐项目。', result: '团队可以开始报价', actionLabel: '维护报价项目库', actionPath: '/subpackages/quote/pages/catalog/manage' },
      { title: '邀请关键成员', description: '至少邀请店长、业务员、设计师和项目经理。', result: '每个岗位看到自己的任务', actionLabel: '邀请员工', actionPath: '/subpackages/company/pages/invite' },
      { title: '建立第一个真实客户', description: '登记客户后继续创建具体房屋。', result: '客户、房屋和项目使用同一主线', actionLabel: '新建客户', actionPath: '/subpackages/customer/pages/edit' },
      { title: '完成第一份报价和项目', description: '让设计师完成报价、客户确认、合同生效和项目创建。', result: '老板能看到真实经营链路', actionLabel: '查看报价工作台', actionPath: '/subpackages/quote/pages/workbench' }
    ]
  },
  storeManager: {
    title: '店长第一次使用',
    subtitle: '先确认门店客户责任，再推动设计师和项目协作。',
    steps: [
      { title: '查看门店客户', description: '确认客户归属、跟进状态和待派单客户。', result: '明确谁负责下一步', actionLabel: '查看客户', actionPath: '/pages/customer/list' },
      { title: '指派设计师', description: '量房后为房屋指定合适的设计师。', result: '设计任务进入设计师工作台', actionLabel: '查看量房工作台', actionPath: '/subpackages/customer/pages/measure-workbench' },
      { title: '检查报价和项目推进', description: '关注待确认报价、合同和项目风险。', result: '门店经营过程持续可见', actionLabel: '查看项目', actionPath: '/pages/project/list' }
    ]
  },
  teamLeader: {
    title: '团队负责人第一次使用',
    subtitle: '先看团队客户的责任和交接，再处理报价与项目风险。',
    steps: [
      { title: '查看团队客户', description: '确认客户在团队成员之间是否有明确负责人。', result: '客户不再无人跟进', actionLabel: '查看客户', actionPath: '/pages/customer/list' },
      { title: '检查设计调度', description: '处理待指派和设计师负荷。', result: '量房到设计不再卡住', actionLabel: '设计调度', actionPath: '/subpackages/team/pages/designers' },
      { title: '检查队内项目和业绩', description: '关注报价、合同、项目逾期和验收。', result: '团队结果可对比、可复盘', actionLabel: '查看业绩', actionPath: '/subpackages/statistic/pages/performance' }
    ]
  },
  marketer: {
    title: '业务员第一次使用',
    subtitle: '先建立客户和房屋，再按跟进节奏推进到量房。',
    steps: [
      { title: '登记客户', description: '填写姓名、电话、来源和意向。', result: '客户进入自己的经营列表', actionLabel: '新建客户', actionPath: '/subpackages/customer/pages/edit' },
      { title: '记录跟进', description: '每次电话、微信、到店或拜访后留下记录和下次时间。', result: '不会忘记下一次联系', actionLabel: '查看客户', actionPath: '/pages/customer/list' },
      { title: '建立房屋并预约量房', description: '先建立具体房屋，再约定量房。', result: '设计接手后有明确执行对象', actionLabel: '量房工作台', actionPath: '/subpackages/customer/pages/measure-workbench' }
    ]
  },
  designer: {
    title: '设计师第一次使用',
    subtitle: '从设计工作台接单，完成量房、方案、报价和选材。',
    steps: [
      { title: '查看待设计房屋', description: '只处理被指派给自己的客户和房屋。', result: '知道自己先做哪一套', actionLabel: '设计工作台', actionPath: '/subpackages/design/pages/workbench' },
      { title: '完成诉求和方案', description: '记录客户诉求、区域和施工主材分项。', result: '方案可以进入报价', actionLabel: '设计工作台', actionPath: '/subpackages/design/pages/workbench' },
      { title: '生成并提交报价', description: '金额由系统计算，成本不完整时不要制造利润。', result: '客户可以确认报价', actionLabel: '报价工作台', actionPath: '/subpackages/quote/pages/workbench' },
      { title: '跟进主材选材', description: '项目推进后逐项确认品牌、规格、颜色和型号。', result: '客户确认结果可以用于采购参考', actionLabel: '选材工作台', actionPath: '/subpackages/project/pages/selection-board' }
    ]
  },
  pm: {
    title: '项目经理第一次使用',
    subtitle: '先接收项目，再按任务节点完成现场留证和验收。',
    steps: [
      { title: '接收项目', description: '确认自己负责的项目和当前阶段。', result: '项目进入自己的履约范围', actionLabel: '履约工作台', actionPath: '/subpackages/team/pages/workbench' },
      { title: '查看施工计划', description: '确认阶段、任务、计划和材料到场风险。', result: '知道今天和未来七天做什么', actionLabel: '查看项目', actionPath: '/pages/project/list' },
      { title: '推进节点并留证', description: '施工、隐蔽和完工节点按真实情况上传照片或视频。', result: '现场事实可追溯', actionLabel: '履约工作台', actionPath: '/subpackages/team/pages/workbench' },
      { title: '提交阶段验收', description: '任务全部完成后提交客户确认，驳回后进入整改。', result: '阶段验收形成闭环', actionLabel: '履约工作台', actionPath: '/subpackages/team/pages/workbench' }
    ]
  },
  finance: {
    title: '财务第一次使用',
    subtitle: '从真实应收应付开始，核对项目资金和成本。',
    steps: [
      { title: '查看应收应付', description: '合同生效、采购到货后形成财务事实。', result: '知道何时收款、付款', actionLabel: '财务工作台', actionPath: '/pages/finance/index' },
      { title: '登记收付款', description: '每次收付款必须有项目、对象和金额。', result: '资金台账和项目对得上', actionLabel: '收付款台账', actionPath: '/subpackages/finance/pages/ledger' },
      { title: '检查成本和利润', description: '成本不完整时保持空值并提示“成本未完整”。', result: '经营报表不制造假利润', actionLabel: '项目财务', actionPath: '/subpackages/finance/pages/projects' }
    ]
  },
  customer: {
    title: '业主第一次使用',
    subtitle: '你的人只看得到自己的项目；进度、选材、付款和验收都在这里。',
    steps: [
      { title: '接受装修公司邀请', description: '邀请绑定成功后进入“我的家”。', result: '可以看到自己的项目和阶段', actionLabel: '返回我的家', actionPath: '/pages/index/index' },
      { title: '查看进度和留证', description: '查看量房、施工动态、相册和当前阶段。', result: '不用反复打电话问进度', actionLabel: '返回我的家', actionPath: '/pages/index/index' },
      { title: '确认选材和验收', description: '确认设计选材，验收有问题可以驳回并等待整改。', result: '关键决定留有记录', actionLabel: '返回我的家', actionPath: '/pages/index/index' }
    ]
  }
}

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'login-phone-required', category: '账号与登录', title: '第一次登录提示授权手机号', summary: '微信只用于确认身份，首次加入企业还需要手机号确认。', symptoms: ['点击微信登录后提示“首次使用，授权手机号继续”', '重新登录后仍要求手机号'], reason: '当前微信尚未绑定手机号；手机号用于身份确认和邀请加入。', actions: ['点击“首次使用，授权手机号继续”', '确认随后看到的是自己的姓名、角色和企业', '如果手机号无法授权，请联系企业管理员重新发送邀请']
  },
  {
    id: 'invite-not-joined', category: '账号与登录', title: '收到邀请但仍显示未加入企业', summary: '通常是没有接受邀请，或登录微信与邀请接收人不一致。', symptoms: ['页面一直停留在“未加入企业”', '看不到企业客户和项目'], reason: '微信凭证尚未与员工或项目授权建立有效关系。', actions: ['从企业管理员发来的邀请链接重新进入', '确认登录的是接收邀请的微信', '仍然失败时让管理员检查员工状态和邀请是否过期']
  },
  {
    id: 'no-property-measure', category: '客户与量房', title: '客户有地址，但不能约定量房', summary: '客户地址不等于房屋档案，量房必须绑定具体房屋。', symptoms: ['客户详情没有“约定量房”主按钮', '填写了小区名称还是不能预约'], reason: '量房绑定的是具体房屋，而不是客户资料中的意向地址。', actions: ['进入客户详情', '在“装修房屋”中添加房屋并填写详细地址', '保存后返回详情，再点击“约定量房”'], actionLabel: '查看客户', actionPath: '/pages/customer/list', roles: ['boss', 'storeManager', 'teamLeader', 'marketer', 'designer']
  },
  {
    id: 'cannot-see-customer', category: '权限与数据', title: '看不到某个客户或项目', summary: '装得清按企业、门店、团队、本人和项目参与关系控制数据范围。', symptoms: ['同事能看到客户，自己看不到', '项目列表数量少于实际项目'], reason: '当前账号不在客户归属、项目参与关系或管理范围内。', actions: ['确认自己的角色和所属门店或团队', '让店长、团队负责人或老板检查负责人和项目成员', '不要通过修改链接或猜测编号尝试访问其他项目']
  },
  {
    id: 'quote-cost-incomplete', category: '设计报价', title: '报价成本不完整，利润不能显示', summary: '缺少应计成本时，系统不会用 0 代替并计算利润。', symptoms: ['利润或毛利率显示为空', '页面提示“成本未完整”'], reason: '项目存在缺少标准成本、采购价或人工成本的材料和施工项。', actions: ['先补齐报价项目、供应商采购价或人工成本', '重新生成或刷新报价', '成本未补齐前不要对外使用利润和毛利率'], actionLabel: '维护报价项目库', actionPath: '/subpackages/quote/pages/catalog/manage', roles: ['boss', 'storeManager', 'finance']
  },
  {
    id: 'contract-no-project', category: '合同与项目', title: '合同签了，为什么还不能创建项目', summary: '签约和合同生效是两个不同状态。', symptoms: ['合同显示“已签约”但没有项目', '创建项目按钮不可用'], reason: '正常业务只有合同生效后才能创建项目。', actions: ['打开合同工作台确认当前状态', '完成合同生效动作', '合同生效后再进入项目创建'], actionLabel: '查看项目合同', actionPath: '/subpackages/project/pages/contract', roles: ['boss', 'storeManager', 'teamLeader', 'designer']
  },
  {
    id: 'selection-not-visible', category: '主材选材', title: '看不到主材选材入口', summary: '选材从合同材料清单发起，只对有项目权限的角色开放。', symptoms: ['项目详情没有“主材选材”', '设计师或客户看不到选材清单'], reason: '合同尚未生效、项目尚未创建，或当前账号不在项目参与范围内。', actions: ['确认合同已生效且项目已创建', '确认账号属于项目成员或业主授权范围', '由设计师从项目或合同工作台进入选材'], actionLabel: '查看项目', actionPath: '/pages/project/list'
  },
  {
    id: 'material-sheet-time', category: '材料采购', title: '作业单的测量、配送、安装和到场时间有什么区别', summary: '作业单记录现场计划时间；要求到场和实际到场在材料计划、采购与到场记录中确认。', symptoms: ['不知道测量日期和到场日期分别填在哪', '提交请购时提示测量字段必填', '作业单有配送日期但看不到实际到场'], reason: '作业单承载现场测量/配送/安装计划，不承载系统时间戳和实际到场事实；当前品类模板可能把测量字段设为必填。', actions: ['在作业单详情确认测量、配送、安装计划日期', '标 * 的模板必填字段补齐后再提交请购', '实际到场数量与日期到材料计划/到场确认中登记'], actionLabel: '材料计划', actionPath: '/subpackages/project/pages/material-plan-workbench', roles: ['designer', 'pm', 'boss', 'storeManager', 'finance']
  },
  {
    id: 'material-sheet-cancel', category: '材料采购', title: '作业单为什么不能直接取消', summary: '未进入采购前可取消并保留原因；进入采购后必须走调整或退货。', symptoms: ['作业单详情没有取消入口', '提示已进入采购，材料与数量锁定', '取消后仍能看到历史单据'], reason: '作业单一旦进入采购，采购单和应付事实已经形成，不能靠取消作业单抹掉；已到货扣减必须走退货。', actions: ['确认作业单是否已经下单或到场', '未进入采购时填写取消原因后取消', '已下单未到走采购调整，已到货走退货或增减项'], actionLabel: '查看材料计划', actionPath: '/subpackages/project/pages/material-plan-workbench', roles: ['designer', 'pm', 'boss', 'storeManager', 'finance']
  },
  {
    id: 'cannot-purchase-material', category: '材料采购', title: '材料计划不能生成采购单', summary: '采购必须从项目材料计划发起，并依赖有效供应商和价格。', symptoms: ['采购页面没有可选择的材料计划', '选择供应商后无法提交'], reason: '材料计划状态不符合采购条件，或供应商、价格、项目参与关系不完整。', actions: ['先确认项目材料计划已生成并进入可采购状态', '检查供应商是否有效、品牌和采购价是否维护', '确认当前角色拥有项目采购权限'], actionLabel: '材料计划', actionPath: '/subpackages/project/pages/material-plan-workbench'
  },
  {
    id: 'upload-failed', category: '异常处理', title: '照片、视频或文件上传失败', summary: '通常是微信权限、网络或单个文件过大导致。', symptoms: ['选择照片后一直上传中', '提示文件上传失败或下载地址过期'], reason: '未授权相机或相册、网络中断，或文件超过当前上传限制。', actions: ['在微信设置中允许相机、相册或文件权限', '切换稳定网络后重试', '重新选择文件；刷新后仍失败时提交反馈并保留问题时间']
  },
  {
    id: 'owner-cannot-see', category: '业主与验收', title: '业主看不到自己的项目', summary: '业主必须使用接收邀请的微信，并成功接受项目授权。', symptoms: ['装修公司员工能看到项目，业主看不到', '业主打开后提示没有项目'], reason: '业主微信未完成邀请绑定，或使用员工账号代替业主登录。', actions: ['使用装修公司发送邀请的同一个微信打开小程序', '重新接受项目邀请', '不要使用员工微信代替业主确认验收']
  },
  {
    id: 'stage-status-conflict', category: '异常处理', title: '项目状态和当前阶段看起来不一致', summary: '状态与阶段必须由同一业务事实推导；发现冲突应记录反馈。', symptoms: ['项目显示待验收，但正在整改', '当前阶段为空或与页面其他位置不一致'], reason: '可能是页面数据未刷新、历史数据缺失，或状态投影暂时不一致。', actions: ['先下拉刷新并重新进入项目', '记录项目名称、页面和看到的两处矛盾', '提交意见反馈，不要在冲突状态下继续确认验收或结算']
  },
  {
    id: 'feedback-progress', category: '异常处理', title: '提交问题后不知道谁在处理', summary: '反馈会记录处理人、处理状态和回复。', symptoms: ['反馈列表只看到“处理中”', '不知道多久能解决'], reason: '问题已经进入处理队列，但尚未完成回复或关闭。', actions: ['打开反馈列表查看处理人和最新回复', '如果问题影响继续操作，点击联系客服补充说明', '提供发生页面、操作步骤和期望结果，便于快速定位'], actionLabel: '查看我的反馈', actionPath: '/subpackages/project/pages/feedback-list'
  }
]

export const HELP_CATEGORIES = ['全部', '账号与登录', '客户与量房', '权限与数据', '设计报价', '合同与项目', '主材选材', '材料采购', '业主与验收', '异常处理']
